import { attributeFields } from 'graphql-sequelize';

import { GraphQLBoolean, GraphQLNonNull } from 'graphql';

export const getPkFieldKey = model => {
  return Object.keys(model.attributes).find(key => {
    const attr = model.attributes[key];
    return attr.primaryKey;
  });
};

export const makeCreateArgs = model => {
  const fields = attributeFields(model);
  const pk = getPkFieldKey(model);

  delete fields[pk];

  return fields;
};

export const makeUpdateArgs = model => {
  const fields = attributeFields(model);

  return Object.keys(fields).reduce((acc, key) => {
    const field = fields[key];

    if (field.type instanceof GraphQLNonNull) {
      field.type = field.type.ofType;
    }

    acc[key] = field;
    return acc;
  }, fields);
};

export const makeDeleteArgs = model => {
  const fields = attributeFields(model);
  const pk = getPkFieldKey(model);

  return { [pk]: fields[pk] };
};
