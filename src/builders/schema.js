import fs from 'fs';
import { GraphQLSchema, GraphQLObjectType, GraphQLList } from 'graphql';
import { resolver, attributeFields, defaultListArgs } from 'graphql-sequelize';
import { plural, singular } from 'pluralize';
import Sequelize, { QueryTypes } from 'sequelize';

import createDefinitions from './definitions';
import {
  isJoinTable,
  findModelKey,
  formatFieldName,
  formatTypeName,
} from '../utils';
import { joinTableAssociations, tableAssociations } from './associations';

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

      acc[formatFieldName(key)] = {
        type: new GraphQLList(type),
        args: defaultListArgs(model),
        resolve: resolver(model),
      };

      return acc;
    }, {});

    const query = new GraphQLObjectType({
      name: 'Query',
      fields,
    });

    resolve(new GraphQLSchema({ query }));
  });
};
