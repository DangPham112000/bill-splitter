import { getHealth } from '../health.js';

export const resolvers = {
  Query: {
    health: () => getHealth(),
  },
};
