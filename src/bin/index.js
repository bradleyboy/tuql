#!/usr/bin/env node

import express from 'express';
import graphqlHTTP from 'express-graphql';
import cors from 'cors';
import commandLineArgs from 'command-line-args';

import buildSchema from '../builders/schema';

const optionDefinitions = [
  { name: 'graphiql', alias: 'g', type: Boolean },
  { name: 'db', type: String, defaultValue: 'database.sqlite' },
  { name: 'port', alias: 'p', type: Number, defaultValue: 4000 },
];

const options = commandLineArgs(optionDefinitions);
const app = express();

console.log('');
console.log(` > Reading schema from ${options.db}`);

buildSchema(options.db).then(schema => {
  app.use(
    '/graphql',
    cors(),
    graphqlHTTP({
      schema,
      graphiql: options.graphiql,
    })
  );

  app.listen(options.port, () =>
    console.log(` > Running at http://localhost:${options.port}/graphql`)
  );
});
