export const typeDefs = `#graphql
  type Health {
    status: String!
    database: String!
    time: String!
  }

  """
  The signed-in user. There is no User table in this app: the Clerk user id is the identity,
  and email, name and avatar come from the ecosystem's shared core.users.
  """
  type Me {
    clerkId: ID!
    "Null only if the user is unknown to both core.users and Clerk."
    email: String
    name: String
    avatar: String
  }

  type Query {
    health: Health!
    "Null when the request is not signed in. Sign-in is optional."
    me: Me
  }
`;
