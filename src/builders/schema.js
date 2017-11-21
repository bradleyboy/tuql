import fs from 'fs';
import { GraphQLSchema, GraphQLObjectType, GraphQLList } from 'graphql';
import { resolver, attributeFields, defaultListArgs } from 'graphql-sequelize';
import { plural, singular } from 'pluralize';
import Sequelize from 'sequelize';

import createDefinitions from './definitions';

const FK_SUFFIX_REGEX = /(_id|Id)$/;

export const buildSchemaFromDatabase = databaseFile => {
  return new Promise(async (resolve, reject) => {
    const db = new Sequelize({
      dialect: 'sqlite',
      storage: databaseFile,
      logging: false,
      operatorsAliases: Sequelize.Op,
    });

    resolve(await build(db));
  });
};

export const buildSchemaFromInfile = infile => {
  return new Promise(async (resolve, reject) => {
    const db = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      operatorsAliases: Sequelize.Op,
    });

    const contents = fs.readFileSync(infile);
    const statements = contents
      .toString()
      .split(/\r?\n|\r/g)
      .filter(s => s.length);

    for (let stmt of statements) {
      await db.query(stmt);
    }

    resolve(await build(db));
  });
};

const build = db => {
  return new Promise(async (resolve, reject) => {
    const models = {};
    const associations = [];

    const tables = await db.query(
      'SELECT name FROM sqlite_master WHERE type = "table"'
    );

    for (let table of tables) {
      const [info, _] = await db.query(`PRAGMA table_info(${table})`);

      // TODO: if has _, check to see if both sides match a table, then add polys
      if (table.indexOf('_') !== -1) {
        const [a, b] = table.split('_').map(plural);
        const keys = info.map(column => column.name);
        const [aKey] = keys.filter(key => key.indexOf(singular(a)) === 0);
        const [bKey] = keys.filter(key => key.indexOf(singular(b)) === 0);

        associations.push({
          from: a,
          to: b,
          type: 'belongsToMany',
          options: {
            through: table,
            foreignKey: aKey,
          },
        });

        associations.push({
          from: b,
          to: a,
          type: 'belongsToMany',
          options: {
            through: table,
            foreignKey: bKey,
          },
        });
      } else {
        models[table] = db.define(table, createDefinitions(info, table), {
          timestamps: false,
          tableName: table,
        });

        info
          .filter(column => {
            return FK_SUFFIX_REGEX.test(column.name);
          })
          .forEach(column => {
            const root = column.name.replace(FK_SUFFIX_REGEX, '');

            associations.push({
              from: plural(root),
              to: table,
              type: 'hasMany',
              options: {
                foreignKey: column.name,
              },
            });

            associations.push({
              from: table,
              to: plural(root),
              type: 'belongsTo',
              options: {
                foreignKey: column.name,
              },
            });
          });
      }
    }

    associations.forEach(({ from, to, type, options }) => {
      const key = type === 'belongsTo' ? singular(to) : to;
      models[from][key] = models[from][type](models[to], options);
    });

    const types = {};

    const fields = Object.keys(models).reduce((acc, key) => {
      const model = models[key];
      const fieldAssociations = {
        hasMany: associations
          .filter(({ type }) => type === 'hasMany')
          .filter(({ from }) => from === key)
          .map(({ to }) => models[to]),
        belongsTo: associations
          .filter(({ type }) => type === 'belongsTo')
          .filter(({ from }) => from === key)
          .map(({ to }) => models[to]),
        belongsToMany: associations
          .filter(({ type }) => type === 'belongsToMany')
          .map(({ from, to }) => [from, to])
          .filter(sides => sides.includes(key)),
      };

      const type = new GraphQLObjectType({
        name: model.name,
        fields() {
          const fields = attributeFields(model);

          fieldAssociations.hasMany.forEach(associatedModel => {
            fields[associatedModel.name] = {
              type: new GraphQLList(types[associatedModel.name]),
              resolve: resolver(model[associatedModel.name]),
            };
          });

          fieldAssociations.belongsTo.forEach(associatedModel => {
            const fieldName = singular(associatedModel.name);
            fields[fieldName] = {
              type: types[associatedModel.name],
              resolve: resolver(model[fieldName]),
            };
          });

          fieldAssociations.belongsToMany.forEach(sides => {
            const other = sides.filter(side => side !== model.name);
            fields[other] = {
              type: new GraphQLList(types[other]),
              resolve: resolver(model[other]),
            };
          });

          return fields;
        },
      });

      types[key] = type;

      acc[key] = {
        type: new GraphQLList(type),
        args: defaultListArgs(model),
        resolve: resolver(model),
      };

      return acc;
    }, {});

    const query = new GraphQLObjectType({
      name: 'RootQueryType',
      fields,
    });

    resolve(new GraphQLSchema({ query }));
  });
};
