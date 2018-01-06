import { TEXT, INTEGER } from 'sequelize';

import definitions from '../builders/definitions';
import { isJoinTable, findModelKey, formatTypeName } from '../utils/index';

describe('definitions', () => {
  it('detects join tables', () => {
    expect(isJoinTable('posts')).toEqual(false);
    expect(isJoinTable('post_author', ['posts', 'authors'])).toEqual(true);
    expect(isJoinTable('post_author', ['posts'])).toEqual(false);
  });

  it('It finds a model key', () => {
    expect(findModelKey('test', { test: 1 })).toEqual('test');
    expect(findModelKey('posts', { post: 1 })).toEqual('post');
    expect(findModelKey('post', { posts: 1 })).toEqual('posts');
  });

  it('It throws when a model key is not found', () => {
    expect(() => {
      findModelKey('foo', { posts: 1 });
    }).toThrow('Model with foo does not exist');
  });
});

describe('formatting', () => {
  it('formats a type name', () => {
    expect(formatTypeName('posts')).toEqual('Post');
  });

  it('formats a type name with more complexity', () => {
    expect(formatTypeName('post_author')).toEqual('PostAuthor');
  });
});
