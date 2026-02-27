import { randomUUID } from "crypto";
import type { IdentityAssuranceProfile } from "@/lib/auth/assurance";
import type { HumanRole } from "@/lib/store";

export type OnboardingCredentialsInput = {
  handle: string;
  displayName: string;
  humanAttestation: string;
};

export type OnboardingErrorCode = "INVALID_HANDLE" | "INVALID_DISPLAY_NAME" | "ATTESTATION_REQUIRED";

export class OnboardingError extends Error {
  readonly code: OnboardingErrorCode;

  constructor(code: OnboardingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OnboardingError";
  }
}

const HANDLE_REGEX = /^[a-z0-9_]{3,24}$/;

export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

export function parseOnboardingCredentials(raw: Record<string, unknown>): OnboardingCredentialsInput {
  const handle = normalizeHandle(String(raw.handle ?? ""));
  const displayName = String(raw.displayName ?? "").trim();
  const humanAttestation = String(raw.humanAttestation ?? "").trim().toLowerCase();

  if (!HANDLE_REGEX.test(handle)) {
    throw new OnboardingError(
      "INVALID_HANDLE",
      "Handle must be 3-24 chars using lowercase letters, numbers, or underscores."
    );
  }

  if (displayName.length < 2 || displayName.length > 60) {
    throw new OnboardingError("INVALID_DISPLAY_NAME", "Display name must be 2-60 characters.");
  }

  if (humanAttestation !== "yes") {
    throw new OnboardingError(
      "ATTESTATION_REQUIRED",
      "Human attestation is required to join HumanOnly."
    );
  }

  return {
    handle,
    displayName,
    humanAttestation
  };
}

function parseRoleAllowList(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((entry) => normalizeHandle(entry))
      .filter(Boolean)
  );
}

export function resolveRole(handle: string): HumanRole {
  const admins = parseRoleAllowList(process.env.HUMANONLY_ADMIN_HANDLES);
  if (admins.has(handle)) {
    return "admin";
  }

  const moderators = parseRoleAllowList(process.env.HUMANONLY_MODERATOR_HANDLES);
  if (moderators.has(handle)) {
    return "moderator";
  }

  return "member";
}

export function buildIdentityProfile(
  input: OnboardingCredentialsInput,
  assuranceProfile?: IdentityAssuranceProfile
) {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    handle: input.handle,
    displayName: input.displayName,
    role: resolveRole(input.handle),
    governanceAcceptedAt: now,
    humanVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    identityAssuranceLevel: assuranceProfile?.level ?? "attested",
    identityAssuranceSignals: assuranceProfile?.signals ?? ["attestation"],
    identityAssuranceEvaluatedAt: assuranceProfile?.evaluatedAt ?? now
  };
}
