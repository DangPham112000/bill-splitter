import { gql } from '@apollo/client';

/** A personal API key for AI agents (DAN-125). The key itself is shown only once. */
export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const API_KEY_FIELDS = gql`
  fragment ApiKeyFields on ApiKey {
    id
    name
    prefix
    createdAt
    lastUsedAt
  }
`;

export const GET_API_KEYS = gql`
  ${API_KEY_FIELDS}
  query ApiKeys {
    apiKeys {
      ...ApiKeyFields
    }
  }
`;

export const CREATE_API_KEY = gql`
  ${API_KEY_FIELDS}
  mutation CreateApiKey($name: String!) {
    createApiKey(name: $name) {
      key
      apiKey {
        ...ApiKeyFields
      }
    }
  }
`;

export const REVOKE_API_KEY = gql`
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id)
  }
`;
