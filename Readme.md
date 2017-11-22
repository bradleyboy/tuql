# tuql

_Pronounced: Too cool_

**tuql** is a simple tool that turns a sanely formatted sqlite database into a graphql endpoint. It tries to infer relationships between objects, currently supporting `belongsTo`, `hasMany` and `belongsToMany`. Currently, only read operations are supported (no mutations).

## Installing

`npm install -g tuql`

## Using

`tuql --db path/to/database.sqlite`

You can also optionally set the port and enable graphiql:

`tuql --db path/to/database.sqlite --port 8888 --graphiql`

Or, you can use a sql file with statements to build up an in-memory database:

`tuql --infile path/to/db_dump.sql --graphiql`

## How it works

Imagine your sqlite schema looked something like this:

| posts | users | categories | category_post |
| :-: | :-: | :-: | :-: |
| id      | id | id | category_id |
| user_id | username | title | post_id |
| title   | | |
| body    | | |

**tuql** will automatically define models and associations, so that graphql queries like this will work right out of the box:

```graphql
{
  posts {
    title
    body
    user {
      username
    }
    categories {
      title
    }
  }
}
```

**tuql** works one of two ways. It prefers to map your schema based on the foreign key information in your tables. If foreign keys are not present, **tuql** assumes the following about your schema in order to map relationships:

1. The primary key column is named `id` or `thing_id` or `thingId`, where `thing` is the singular form of the table name. Example: For a table named **posts**, the primary key column should be named `id`, `post_id` or `postId`.
2. Similarly, foreign key columns should be `thing_id` or `thingId`, where `thing` is the singular form of the associated table.
3. For many-to-many associations, the table name should be in the form of `foo_bar` or `bar_foo` (ordering is not important). The columns should follow the same pattern as #2 above.
