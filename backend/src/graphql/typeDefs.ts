export const typeDefs = `#graphql
  type Health {
    status: String!
    database: String!
    time: String!
  }

  type Query {
    health: Health!
  }
`;
