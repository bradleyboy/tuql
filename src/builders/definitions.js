import { TEXT, INTEGER, REAL, NUMERIC, BLOB, BOOLEAN } from 'sequelize';
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
    c === 'date' ||
    c === 'datetime'
  ) {
    return NUMERIC;
  }

  if (c === 'boolean') {
    return BOOLEAN;
  }

  return BLOB;
};

export default columns => {
  return columns.reduce((acc, column) => {
    acc[formatFieldName(column.name)] = {
      type: transformColumnToType(column.type),
      primaryKey: column.pk === 1,
      field: column.name,
      allowNull: column.notnull === 0 || column.dflt_value !== null,
      defaultValue: column.dflt_value,
      autoIncrement: column.type === 'integer' && column.pk === 1,
    };

    return acc;
  }, {});
};
