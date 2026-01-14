import gql from "graphql-tag";

export const typeDefs = gql`
  scalar DateTime

  type Persona {
    id: ID!
    name: String!
    tone: String!
    bias: String!
    createdAt: DateTime!
  }

  type Argument {
    id: ID!
    debateId: ID!
    personaId: ID!
    persona: Persona!
    content: String!
    roundNumber: Int!
    voteCount: Int!
    createdAt: DateTime!
  }

  type Vote {
    id: ID!
    argumentId: ID!
    debateId: ID!
    voterFingerprint: String!
    createdAt: DateTime!
  }

  type Debate {
    id: ID!
    topic: String!
    personaA: Persona!
    personaB: Persona!
    status: DebateStatus!
    totalRounds: Int!
    currentRound: Int!
    winnerId: ID
    winner: Persona
    judgmentSummary: String
    arguments: [Argument!]!
    argumentCount: Int!
    spectatorCount: Int!
    createdAt: DateTime!
  }

  enum DebateStatus {
    active
    completed
    error
  }

  type Query {
    debates: [Debate!]!
    debate(id: ID!): Debate
    arguments(debateId: ID!): [Argument!]!
  }

  input CreateDebateInput {
    topic: String!
    personaAName: String!
    personaATone: String!
    personaABias: String!
    personaBName: String!
    personaBTone: String!
    personaBBias: String!
    totalRounds: Int
  }

  input VoteInput {
    argumentId: ID!
    debateId: ID!
    voterFingerprint: String!
  }

  type CreateDebatePayload {
    debateId: ID!
    debate: Debate!
  }

  type VotePayload {
    vote: Vote!
    argument: Argument!
  }

  type Mutation {
    createDebate(input: CreateDebateInput!): CreateDebatePayload!
    vote(input: VoteInput!): VotePayload!
  }

  type Subscription {
    debateUpdated(debateId: ID!): DebateEvent!
  }

  union DebateEvent = ArgumentEvent | TypingEvent | JudgmentEvent | ErrorEvent

  type ArgumentEvent {
    type: String!
    argument: Argument!
  }

  type TypingEvent {
    type: String!
    personaName: String!
  }

  type JudgmentEvent {
    type: String!
    winnerId: ID!
    judgmentSummary: String!
  }

  type ErrorEvent {
    type: String!
    message: String!
  }
`;
