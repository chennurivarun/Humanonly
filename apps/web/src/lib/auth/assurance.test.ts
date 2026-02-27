import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IdentityAssuranceError,
  issueIdentityChallenge,
  parseIdentityAssuranceEvidence,
  verifyIdentityAssuranceEvidence
} from "./assurance";

const TEST_SECRET = "test-assurance-secret";
const BASE_TIME = new Date("2026-02-27T08:00:00.000Z");

describe("parseIdentityAssuranceEvidence", () => {
  it("accepts governance commitment and challenge payload", () => {
    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: "yes",
      challengeToken: "token",
      challengeResponse: "human civic signal"
    });

    assert.equal(evidence.governanceCommitment, true);
    assert.equal(evidence.challengeToken, "token");
    assert.equal(evidence.challengeResponse, "human civic signal");
  });

  it("requires governance commitment", () => {
    assert.throws(
      () =>
        parseIdentityAssuranceEvidence({
          governanceCommitment: "no",
          challengeToken: "token",
          challengeResponse: "text"
        }),
      (error) => error instanceof IdentityAssuranceError && error.code === "GOVERNANCE_COMMITMENT_REQUIRED"
    );
  });
});

describe("identity challenge lifecycle", () => {
  it("issues and verifies a valid challenge", () => {
    const issued = issueIdentityChallenge({
      now: BASE_TIME,
      phraseIndex: 1,
      nonce: "nonce-1",
      secret: TEST_SECRET,
      minSolveSeconds: 3,
      ttlSeconds: 300
    });

    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: "on",
      challengeToken: issued.token,
      challengeResponse: issued.challengeText
    });

    const profile = verifyIdentityAssuranceEvidence(evidence, {
      now: new Date(BASE_TIME.getTime() + 5_000),
      secret: TEST_SECRET
    });

    assert.equal(profile.level, "enhanced");
    assert.deepEqual(profile.signals, ["attestation", "governance_commitment", "interactive_challenge"]);
  });

  it("rejects responses that are submitted too quickly", () => {
    const issued = issueIdentityChallenge({
      now: BASE_TIME,
      phraseIndex: 2,
      nonce: "nonce-2",
      secret: TEST_SECRET,
      minSolveSeconds: 5,
      ttlSeconds: 300
    });

    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: true,
      challengeToken: issued.token,
      challengeResponse: issued.challengeText
    });

    assert.throws(
      () =>
        verifyIdentityAssuranceEvidence(evidence, {
          now: new Date(BASE_TIME.getTime() + 2_000),
          secret: TEST_SECRET
        }),
      (error) => error instanceof IdentityAssuranceError && error.code === "CHALLENGE_TOO_FAST"
    );
  });

  it("rejects expired challenges", () => {
    const issued = issueIdentityChallenge({
      now: BASE_TIME,
      phraseIndex: 3,
      nonce: "nonce-3",
      secret: TEST_SECRET,
      minSolveSeconds: 1,
      ttlSeconds: 10
    });

    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: true,
      challengeToken: issued.token,
      challengeResponse: issued.challengeText
    });

    assert.throws(
      () =>
        verifyIdentityAssuranceEvidence(evidence, {
          now: new Date(BASE_TIME.getTime() + 11_000),
          secret: TEST_SECRET
        }),
      (error) => error instanceof IdentityAssuranceError && error.code === "CHALLENGE_EXPIRED"
    );
  });

  it("rejects mismatched challenge responses", () => {
    const issued = issueIdentityChallenge({
      now: BASE_TIME,
      phraseIndex: 0,
      nonce: "nonce-4",
      secret: TEST_SECRET,
      minSolveSeconds: 1,
      ttlSeconds: 300
    });

    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: true,
      challengeToken: issued.token,
      challengeResponse: "wrong response"
    });

    assert.throws(
      () =>
        verifyIdentityAssuranceEvidence(evidence, {
          now: new Date(BASE_TIME.getTime() + 3_000),
          secret: TEST_SECRET
        }),
      (error) => error instanceof IdentityAssuranceError && error.code === "CHALLENGE_MISMATCH"
    );
  });

  it("rejects tampered tokens", () => {
    const issued = issueIdentityChallenge({
      now: BASE_TIME,
      phraseIndex: 4,
      nonce: "nonce-5",
      secret: TEST_SECRET,
      minSolveSeconds: 1,
      ttlSeconds: 300
    });

    const evidence = parseIdentityAssuranceEvidence({
      governanceCommitment: true,
      challengeToken: `${issued.token}tamper`,
      challengeResponse: issued.challengeText
    });

    assert.throws(
      () =>
        verifyIdentityAssuranceEvidence(evidence, {
          now: new Date(BASE_TIME.getTime() + 3_000),
          secret: TEST_SECRET
        }),
      (error) => error instanceof IdentityAssuranceError && error.code === "CHALLENGE_INVALID"
    );
  });
});
