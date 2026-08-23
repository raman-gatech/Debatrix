import { print } from "graphql";
import { describe, expect, it } from "vitest";
import { typeDefs } from "../../server/graphql/schema";

describe("GraphQL schema", () => {
  it("represents every persisted debate status", () => {
    const schema = print(typeDefs);
    expect(schema).toMatch(/enum DebateStatus \{[\s\S]*active[\s\S]*paused[\s\S]*completed[\s\S]*error[\s\S]*\}/);
  });
});
