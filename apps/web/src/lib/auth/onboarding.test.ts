import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OnboardingError,
  normalizeHandle,
  parseOnboardingCredentials,
  resolveRole
} from "./onboarding";

const previousAdminHandles = process.env.HUMANONLY_ADMIN_HANDLES;
const previousModeratorHandles = process.env.HUMANONLY_MODERATOR_HANDLES;

afterEach(() => {
  process.env.HUMANONLY_ADMIN_HANDLES = previousAdminHandles;
  process.env.HUMANONLY_MODERATOR_HANDLES = previousModeratorHandles;
});

describe("normalizeHandle", () => {
  it("normalizes casing and trims spaces", () => {
    assert.equal(normalizeHandle("  VaRun_101  "), "varun_101");
  });
});

describe("parseOnboardingCredentials", () => {
  it("accepts valid onboarding payload", () => {
    const parsed = parseOnboardingCredentials({
      handle: "human_author",
      displayName: "Human Author",
      humanAttestation: "yes"
    });

    assert.equal(parsed.handle, "human_author");
    assert.equal(parsed.displayName, "Human Author");
  });

  it("rejects invalid handles", () => {
    assert.throws(
      () =>
        parseOnboardingCredentials({
          handle: "INVALID-HANDLE",
          displayName: "Human Author",
          humanAttestation: "yes"
        }),
      (error) => error instanceof OnboardingError && error.code === "INVALID_HANDLE"
    );
  });

  it("requires explicit human attestation", () => {
    assert.throws(
      () =>
        parseOnboardingCredentials({
          handle: "valid_user",
          displayName: "Valid User",
          humanAttestation: "no"
        }),
      (error) => error instanceof OnboardingError && error.code === "ATTESTATION_REQUIRED"
    );
  });
});

describe("resolveRole", () => {
  it("returns admin when handle is allow-listed", () => {
    process.env.HUMANONLY_ADMIN_HANDLES = "chief_admin";
    process.env.HUMANONLY_MODERATOR_HANDLES = "queue_mod";

    assert.equal(resolveRole("chief_admin"), "admin");
  });

  it("returns moderator when moderator allow-listed", () => {
    process.env.HUMANONLY_ADMIN_HANDLES = "chief_admin";
    process.env.HUMANONLY_MODERATOR_HANDLES = "queue_mod";

    assert.equal(resolveRole("queue_mod"), "moderator");
  });

  it("falls back to member for unknown handles", () => {
    process.env.HUMANONLY_ADMIN_HANDLES = "chief_admin";
    process.env.HUMANONLY_MODERATOR_HANDLES = "queue_mod";

    assert.equal(resolveRole("new_member"), "member");
  });
});
