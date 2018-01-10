import { TEXT, INTEGER } from 'sequelize';

import definitions from '../builders/definitions';

describe('definitions', () => {
  it('does the thing', () => {
    const results = definitions([
      {
        name: 'AlbumId',
        pk: 1,
        type: 'TEXT',
      },
      {
        name: 'post_id',
        pk: 0,
        type: 'INTEGER',
      },
    ]);

    expect(results).toEqual({
      albumId: {
        field: 'AlbumId',
        primaryKey: true,
        type: TEXT,
        allowNull: true,
        autoIncrement: false,
        defaultValue: undefined,
      },
      postId: {
        field: 'post_id',
        primaryKey: false,
        type: INTEGER,
        allowNull: true,
        autoIncrement: false,
        defaultValue: undefined,
      },
    });
  });

  it('does the thing with int pks', () => {
    const results = definitions([
      {
        name: 'AlbumId',
        pk: 1,
        type: 'INTEGER',
      },
      {
        name: 'post_id',
        pk: 0,
        type: 'INTEGER',
      },
    ]);

    expect(results).toEqual({
      albumId: {
        field: 'AlbumId',
        primaryKey: true,
        type: INTEGER,
        allowNull: true,
        autoIncrement: true,
        defaultValue: undefined,
      },
      postId: {
        field: 'post_id',
        primaryKey: false,
        type: INTEGER,
        allowNull: true,
        autoIncrement: false,
        defaultValue: undefined,
      },
    });
  });
});
