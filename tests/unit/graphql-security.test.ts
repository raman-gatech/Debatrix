import { describe, expect, it } from "vitest";
import { getOperationAST, parse } from "graphql";

describe("GraphQL request boundary", () => {
  it("distinguishes mutations from read-only operations for mutation quotas", () => {
    const mutation = getOperationAST(parse("mutation Create { createDebate(input: {}) { debateId } }"))!;
    const query = getOperationAST(parse("query List { debates { id } }"))!;

    expect(mutation.operation).toBe("mutation");
    expect(query.operation).toBe("query");
  });
});
