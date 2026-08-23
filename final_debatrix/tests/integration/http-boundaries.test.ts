import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../server/app";
import type { Server } from "node:http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server } = await createApplication());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("HTTP security boundaries", () => {
  it("serves liveness without exposing readiness as healthy without dependencies", async () => {
    const liveness = await fetch(`${baseUrl}/healthz`);
    const readiness = await fetch(`${baseUrl}/readyz`);

    expect(liveness.status).toBe(200);
    expect(await liveness.json()).toEqual({ status: "ok" });
    expect(liveness.headers.get("x-content-type-options")).toBe("nosniff");
    expect(liveness.headers.get("x-powered-by")).toBeNull();
    expect(readiness.status).toBe(503);
  });

  it("rejects invalid read query parameters", async () => {
    const response = await fetch(`${baseUrl}/api/debates?status=invalid`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("does not allow an anonymous caller to mutate data", async () => {
    const response = await fetch(`${baseUrl}/api/personas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", tone: "Calm", bias: "Neutral" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("enforces authentication for GraphQL mutations as well", async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5000" },
      body: JSON.stringify({
        query: `mutation Create($input: CreateDebateInput!) { createDebate(input: $input) { debateId } }`,
        variables: {
          input: {
            topic: "Should governments regulate artificial intelligence?",
            personaAName: "Advocate",
            personaATone: "Analytical",
            personaABias: "Supports responsible innovation",
            personaBName: "Skeptic",
            personaBTone: "Cautious",
            personaBBias: "Prioritizes public safety",
            totalRounds: 1,
          },
        },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ errors: [{ extensions: { code: "UNAUTHENTICATED" } }] });
  });

  it("rejects an oversized request before route logic executes", async () => {
    const response = await fetch(`${baseUrl}/api/personas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(33 * 1024) }),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});
