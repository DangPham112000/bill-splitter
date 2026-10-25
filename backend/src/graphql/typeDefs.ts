export const typeDefs = `#graphql
  type Health {
    status: String!
    database: String!
    time: String!
  }

  "The signed-in user. Only the Clerk user id: there is no User table in this app."
  type Me {
    clerkId: ID!
  }

  type Query {
    health: Health!
    "Null when the request is not signed in. Sign-in is optional."
    me: Me
  }
`;
