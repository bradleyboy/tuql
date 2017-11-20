#!/usr/bin/env node

import fs from 'fs';
import express from 'express';
import graphqlHTTP from 'express-graphql';
import cors from 'cors';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

import buildSchema from '../builders/schema';

const optionDefinitions = [
  {
    name: 'graphiql',
    alias: 'g',
    type: Boolean,
    description: 'Enable graphiql UI',
  },
  {
    name: 'db',
    type: String,
    defaultValue: 'database.sqlite',
    description:
      'Path to the sqlite database you want to create a graphql endpoint for',
  },
  {
    name: 'port',
    alias: 'p',
    type: Number,
    defaultValue: 4000,
    description: 'Port to run on (Default: 4000)',
  },
  { name: 'help', alias: 'h', type: Boolean, description: 'This help output' },
];

const options = commandLineArgs(optionDefinitions);

if (options.help) {
  const usage = commandLineUsage([
    {
      header: 'tuql',
      content:
        '[underline]{tuql} turns just about any sqlite database into a graphql endpoint, including inferring associations',
    },
    {
      header: 'Basic usage',
      content: 'tuql --db path/to/db.sqlite',
    },
    {
      header: 'Options',
      optionList: optionDefinitions,
    },
    {
      content: 'Project home: [underline]{https://github.com/bradleyboy/tuql}',
    },
  ]);
  console.log(usage);
  process.exit();
}

const app = express();

console.log('');
console.log(` > Reading schema from ${options.db}`);

buildSchema(fs.realpathSync(options.db)).then(schema => {
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
