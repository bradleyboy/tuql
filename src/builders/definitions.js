import { TEXT, INTEGER, REAL, NUMERIC, BLOB } from 'sequelize';
import { singular } from 'pluralize';
import { formatFieldName } from '../utils';

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
    c.includes('numeric') ||
    c === 'boolean' ||
    c === 'date' ||
    c === 'datetime'
  ) {
    return NUMERIC;
  }

  return BLOB;
};

export default (columns, tableName) => {
  return columns.reduce((acc, column) => {
    acc[formatFieldName(column.name)] = {
      type: transformColumnToType(column.type),
      primaryKey: column.pk === 1,
      field: column.name,
      allowNull: column.notnull === 0 || column.dflt_value !== null,
      defaultValue: column.dflt_value,
      autoIncrement: column.type === 'INTEGER' && column.pk === 1,
    };

    return acc;
  }, {});
};
