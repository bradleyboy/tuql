import Sequelize from 'sequelize';
import { TEXT, INTEGER, REAL, NUMERIC, BLOB } from 'sequelize';

import {
  getPkFieldKey,
  makeCreateArgs,
  makeUpdateArgs,
  makeDeleteArgs,
} from '../builders/arguments';
import { GraphQLString, GraphQLNonNull, GraphQLInt } from 'graphql';

const db = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  operatorsAliases: Sequelize.Op,
});

const model = db.define(
  'model',
  {
    id: {
      type: INTEGER,
      primaryKey: true,
    },
    title: {
      type: TEXT,
      allowNull: true,
    },
    userId: {
      type: INTEGER,
      allowNull: false,
    },
  },
  { timestamps: false }
);

describe('getPkField', () => {
  it('detects the primary key key', () => {
    const pk = getPkFieldKey(model);
    expect(pk).toBe('id');
  });

  it('makeCreateArgs', () => {
    const args = makeCreateArgs(model);
    expect(args).toEqual({
      title: { type: GraphQLString },
      userId: { type: new GraphQLNonNull(GraphQLInt) },
    });
  });

  it('makeUpdateArgs', () => {
    const args = makeUpdateArgs(model);
    expect(args).toEqual({
      id: { type: GraphQLInt },
      title: { type: GraphQLString },
      userId: { type: GraphQLInt },
    });
  });

  it('makeDeleteArgs', () => {
    const args = makeDeleteArgs(model);
    expect(args).toEqual({
      id: { type: new GraphQLNonNull(GraphQLInt) },
    });
  });
});
