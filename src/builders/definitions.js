import { TEXT, INTEGER, REAL, NUMERIC, BLOB } from 'sequelize';
import { singular } from 'pluralize';

const transformColumnToType = column => {
  const c = column.toLowerCase();

  if (c.includes('int')) {
    return INTEGER;
  }

  if (c.includes('char') || c === 'clob' || c === 'text') {
    return TEXT;
  }

  if (c.includes('double') || c === 'real' || c === 'float') {
    return REAL;
  }

  if (
    c.includes('decimal') ||
    c === 'numeric' ||
    c === 'boolean' ||
    c === 'date' ||
    c === 'datetime'
  ) {
    return NUMERIC;
  }

  return BLOB;
};

export default (columns, tableName) => {
  const root = singular(tableName);
  const pkTest = new RegExp(`^${root}(Id|_id)$`);

  return columns.reduce((acc, column) => {
    acc[column.name] = {
      type: transformColumnToType(column.type),
      primaryKey: column.name === 'id' || pkTest.test(column.name),
    };

    return acc;
  }, {});
};
