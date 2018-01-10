import fs from 'fs';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLBoolean,
} from 'graphql';
import {
  resolver,
  attributeFields,
  defaultListArgs,
  defaultArgs,
} from 'graphql-sequelize';
import { plural, singular } from 'pluralize';
import Sequelize, { QueryTypes } from 'sequelize';

import createDefinitions from './definitions';
import {
  isJoinTable,
  findModelKey,
  formatFieldName,
  formatTypeName,
  pascalCase,
} from '../utils';
import { joinTableAssociations, tableAssociations } from './associations';
import {
  makeCreateArgs,
  makeUpdateArgs,
  makeDeleteArgs,
  getPkFieldKey,
  makePolyArgs,
  getPolyKeys,
} from './arguments';

const GenericResponseType = new GraphQLObjectType({
  name: 'GenericResponse',
  fields: {
    success: { type: GraphQLBoolean },
  },
});

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

    const tables = await db.query(
      'SELECT name FROM sqlite_master WHERE type = "table" AND name NOT LIKE "sqlite_%"'
    );

    for (let table of tables) {
      const [info, infoMeta] = await db.query(`PRAGMA table_info("${table}")`);
      const foreignKeys = await db.query(`PRAGMA foreign_key_list("${table}")`);

      if (isJoinTable(table, tables)) {
        associations = associations.concat(
          joinTableAssociations(table, info, foreignKeys)
        );
      } else {
        models[table] = db.define(table, createDefinitions(info, table), {
          timestamps: false,
          tableName: table,
        });

        associations = associations.concat(
          tableAssociations(table, info, foreignKeys)
        );
      }
    }

    associations.forEach(({ from, to, type, options }) => {
      const key = type === 'belongsTo' ? singular(to) : to;
      const fromKey = findModelKey(from, models);
      const toKey = findModelKey(to, models);
      models[fromKey][key] = models[fromKey][type](models[toKey], options);
    });

    const types = {};
    const mutations = {};
    const queries = {};

    Object.keys(models).forEach(key => {
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
        name: formatTypeName(model.name),
        fields() {
          const fields = attributeFields(model);

          fieldAssociations.hasMany.forEach(associatedModel => {
            fields[formatFieldName(associatedModel.name)] = {
              type: new GraphQLList(types[associatedModel.name]),
              args: defaultListArgs(model[associatedModel.name]),
              resolve: resolver(model[associatedModel.name]),
            };
          });

          fieldAssociations.belongsTo.forEach(associatedModel => {
            const fieldName = singular(associatedModel.name);
            fields[formatFieldName(fieldName)] = {
              type: types[associatedModel.name],
              resolve: resolver(model[fieldName]),
            };
          });

          fieldAssociations.belongsToMany.forEach(sides => {
            const [other] = sides.filter(side => side !== model.name);
            fields[formatFieldName(other)] = {
              type: new GraphQLList(types[other]),
              resolve: resolver(model[other]),
            };
          });

          return fields;
        },
      });

      types[key] = type;

      queries[formatFieldName(key)] = {
        type: new GraphQLList(type),
        args: defaultListArgs(model),
        resolve: resolver(model),
      };

      queries[singular(formatFieldName(key))] = {
        type,
        args: defaultArgs(model),
        resolve: resolver(model),
      };

      mutations[`create${type}`] = {
        type,
        args: makeCreateArgs(model),
        resolve: async (obj, values, info) => {
          const thing = await model.create(values);
          return thing;
        },
      };

      mutations[`update${type}`] = {
        type,
        args: makeUpdateArgs(model),
        resolve: async (obj, values, info) => {
          const pkKey = getPkFieldKey(model);

          const thing = await model.findOne({
            where: { [pkKey]: values[pkKey] },
          });

          await thing.update(values);

          return thing;
        },
      };

      mutations[`delete${type}`] = {
        type: GenericResponseType,
        args: makeDeleteArgs(model),
        resolve: async (obj, values, info) => {
          const thing = await model.findOne({
            where: values,
          });

          await thing.destroy();

          return {
            success: true,
          };
        },
      };

      fieldAssociations.belongsToMany.forEach(sides => {
        const [other] = sides.filter(side => side !== model.name);
        const nameBits = [formatTypeName(model.name), formatTypeName(other)];

        ['add', 'remove'].forEach(prefix => {
          const connector = prefix === 'add' ? 'To' : 'From';
          const name = `${prefix}${nameBits.join(connector)}`;
          mutations[name] = {
            type: GenericResponseType,
            args: makePolyArgs(model, models[other]),
            resolve: async (obj, values, info) => {
              const key = getPkFieldKey(model);
              const [, , otherArgumentKey] = getPolyKeys(model, models[other]);

              const thingOne = await model.findById(values[key]);
              const thingTwo = await models[other].findById(
                values[otherArgumentKey]
              );

              const method = `${prefix}${pascalCase(singular(other))}`;

              await thingOne[method](thingTwo);

              return {
                success: true,
              };
            },
          };
        });
      });
    });

    const query = new GraphQLObjectType({
      name: 'Query',
      fields: queries,
    });

    const mutation = new GraphQLObjectType({
      name: 'Mutation',
      fields: mutations,
    });

    resolve(
      new GraphQLSchema({
        query,
        mutation,
      })
    );
  });
};
