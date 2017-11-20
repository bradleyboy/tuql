# tuql

_Pronounced: Too cool_

*tuql* is a simple tool that turns a sanely formatted sqlite database into a graphql endpoint. It tries to infer relationships between objects, currently supporting `belongsTo`, `hasMany` and `belongsToMany`. Currently, only read operations are supported (no mutations).

## Installing

`npm install -g tuql`

## Using

`tuql --db path/to/database.sqlite`

You can also optionally set the port and enable graphiql:

`tuql --db path/to/database.sqlite --port 8888 --graphiql`
