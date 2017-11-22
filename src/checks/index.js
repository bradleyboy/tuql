import { plural, singular } from 'pluralize';

export const isJoinTable = (tableName, tableList) => {
  const sides = tableName.split('_').map(plural);

  if (sides.length !== 2) {
    return false;
  }

  const [one, two] = sides;

  return tableList.includes(one) && tableList.includes(two);
};
