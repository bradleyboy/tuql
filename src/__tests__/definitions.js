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
      },
      postId: {
        field: 'post_id',
        primaryKey: false,
        type: INTEGER,
      },
    });
  });
});
