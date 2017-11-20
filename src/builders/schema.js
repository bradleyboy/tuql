import fs from 'fs';
import { GraphQLSchema, GraphQLObjectType, GraphQLList } from 'graphql';
import { resolver, attributeFields, defaultListArgs } from 'graphql-sequelize';
import { plural, singular } from 'pluralize';
import Sequelize from 'sequelize';

import createDefinitions from './definitions';
import { posix } from 'path';

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
    let associations = [];
    let polyAssociations = [];

    const tables = await db.query(
      'SELECT name FROM sqlite_master WHERE type = "table"'
    );

    for (let table of tables) {
      const [info, _] = await db.query(`PRAGMA table_info(${table})`);

      if (table.indexOf('_') !== -1) {
        polyAssociations.push({
          through: table,
          sides: table.split('_').map(plural),
          keys: info.map(column => column.name),
        });
      } else {
        models[table] = db.define(table, createDefinitions(info, table), {
          timestamps: false,
          tableName: table,
        });

        associations = associations.concat(
          info
            .filter(column => {
              return FK_SUFFIX_REGEX.test(column.name);
            })
            .map(column => {
              const root = column.name.replace(FK_SUFFIX_REGEX, '');

              return {
                column: column.name,
                owner: plural(root),
                target: table,
              };
            })
        );
      }
    }

    polyAssociations.forEach(({ through, sides, keys }) => {
      const [a, b] = sides;
      const [aKey] = keys.filter(key => key.indexOf(singular(a)) === 0);
      const [bKey] = keys.filter(key => key.indexOf(singular(b)) === 0);

      models[a][b] = models[a].belongsToMany(models[b], {
        through,
        foreignKey: aKey,
      });

      models[b][a] = models[b].belongsToMany(models[a], {
        through,
        foreignKey: bKey,
      });
    });

    associations.forEach(({ owner, target, column }) => {
      models[owner][target] = models[owner].hasMany(models[target], {
        foreignKey: column,
      });

      models[target][singular(owner)] = models[target].belongsTo(
        models[owner],
        { foreignKey: column }
      );
    });

    const types = {};

    const fields = Object.keys(models).reduce((acc, key) => {
      const model = models[key];
      const fieldAssociations = {
        hasMany: associations
          .filter(({ owner }) => owner === key)
          .map(({ target }) => models[target]),
        belongsTo: associations
          .filter(({ target }) => target === key)
          .map(({ owner }) => models[owner]),
        belongsToMany: polyAssociations
          .filter(({ sides }) => sides.includes(key))
          .map(({ sides }) => sides),
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
