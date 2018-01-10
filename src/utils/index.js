import { plural, singular } from 'pluralize';
import camelcase from 'camelcase';

export const isJoinTable = (tableName, tableList) => {
  const sides = tableName.split('_').map(plural);

  if (sides.length !== 2) {
    return false;
  }

  const [one, two] = sides;

  return tableList.includes(one) && tableList.includes(two);
};

export const formatTypeName = name => {
  return pascalCase(singular(name));
};

export const pascalCase = string => {
  const cameled = camelcase(string);
  return cameled.substr(0, 1).toUpperCase() + cameled.substr(1);
};

export const findModelKey = (key, models) => {
  if (models[key]) {
    return key;
  }

  const pluralKey = plural(key);

  if (models[pluralKey]) {
    return pluralKey;
  }

  const singularKey = singular(key);

  if (models[singularKey]) {
    return singularKey;
  }

  throw Error(`Model with ${key} does not exist`);
};

export const formatFieldName = camelcase;
