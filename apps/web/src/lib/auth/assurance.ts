import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_CHALLENGE_TTL_SECONDS = 10 * 60;
const DEFAULT_MIN_SOLVE_SECONDS = 3;

const CHALLENGE_PHRASES = [
  "ink and paper",
  "human civic signal",
  "trusted local voice",
  "governance before automation",
  "real people deliberate"
] as const;

const ASSURANCE_LEVELS = ["attested", "enhanced", "manual_override"] as const;
const ASSURANCE_SIGNALS = [
  "attestation",
  "governance_commitment",
  "interactive_challenge",
  "manual_override",
  "seed_bootstrap"
] as const;

export type IdentityAssuranceLevel = (typeof ASSURANCE_LEVELS)[number];
export type IdentityAssuranceSignal = (typeof ASSURANCE_SIGNALS)[number];

export type IdentityAssuranceProfile = {
  level: IdentityAssuranceLevel;
  signals: IdentityAssuranceSignal[];
  evaluatedAt: string;
};

export type IdentityAssuranceEvidenceInput = {
  governanceCommitment: boolean;
  challengeToken: string;
  challengeResponse: string;
};

export type IssueIdentityChallengeOptions = {
  now?: Date;
  phraseIndex?: number;
  nonce?: string;
  ttlSeconds?: number;
  minSolveSeconds?: number;
  secret?: string;
};

export type VerifyIdentityAssuranceOptions = {
  now?: Date;
  secret?: string;
};

export type IdentityChallenge = {
  token: string;
  prompt: string;
  challengeText: string;
  issuedAt: string;
  expiresAt: string;
  minSolveAt: string;
};

export type IdentityAssuranceErrorCode =
  | "GOVERNANCE_COMMITMENT_REQUIRED"
  | "CHALLENGE_TOKEN_REQUIRED"
  | "CHALLENGE_RESPONSE_REQUIRED"
  | "CHALLENGE_INVALID"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_TOO_FAST"
  | "CHALLENGE_MISMATCH";

export class IdentityAssuranceError extends Error {
  readonly code: IdentityAssuranceErrorCode;

  constructor(code: IdentityAssuranceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "IdentityAssuranceError";
  }
}

type ChallengeTokenPayload = {
  v: 1;
  nonce: string;
  answerHash: string;
  issuedAt: string;
  expiresAt: string;
  minSolveAt: string;
};

function parseBoolean(value: unknown): boolean {
  if (value === true) {
    return true;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "on";
}

function normalizeResponse(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseSeconds(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function resolveSecret(override?: string): string {
  if (override && override.trim()) {
    return override.trim();
  }

  const configured = process.env.HUMANONLY_IDENTITY_ASSURANCE_SECRET?.trim();
  if (configured) {
    return configured;
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (nextAuthSecret) {
    return nextAuthSecret;
  }

  return "dev-humanonly-identity-assurance-secret";
}

function signPayload(payloadEncoded: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

function hashChallengeResponse(response: string, nonce: string): string {
  return createHash("sha256").update(`${normalizeResponse(response)}::${nonce}`).digest("hex");
}

function parsePayload(token: string, secret: string): ChallengeTokenPayload {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Challenge token has invalid format");
  }

  const expectedSignature = signPayload(encodedPayload, secret);

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(encodedSignature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Challenge token signature mismatch");
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Challenge token payload is unreadable");
  }

  if (!rawPayload || typeof rawPayload !== "object") {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Challenge token payload is invalid");
  }

  const payload = rawPayload as Record<string, unknown>;

  if (payload.v !== 1) {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Unsupported challenge version");
  }

  for (const key of ["nonce", "answerHash", "issuedAt", "expiresAt", "minSolveAt"] as const) {
    if (typeof payload[key] !== "string" || !payload[key]) {
      throw new IdentityAssuranceError("CHALLENGE_INVALID", `Challenge payload missing ${key}`);
    }
  }

  return {
    v: 1,
    nonce: payload.nonce as string,
    answerHash: payload.answerHash as string,
    issuedAt: payload.issuedAt as string,
    expiresAt: payload.expiresAt as string,
    minSolveAt: payload.minSolveAt as string
  };
}

export function parseIdentityAssuranceEvidence(raw: Record<string, unknown>): IdentityAssuranceEvidenceInput {
  const governanceCommitment = parseBoolean(raw.governanceCommitment);
  const challengeToken = String(raw.challengeToken ?? "").trim();
  const challengeResponse = String(raw.challengeResponse ?? "").trim();

  if (!governanceCommitment) {
    throw new IdentityAssuranceError(
      "GOVERNANCE_COMMITMENT_REQUIRED",
      "Governance commitment is required to complete onboarding."
    );
  }

  if (!challengeToken) {
    throw new IdentityAssuranceError("CHALLENGE_TOKEN_REQUIRED", "Identity challenge token is required.");
  }

  if (!challengeResponse) {
    throw new IdentityAssuranceError("CHALLENGE_RESPONSE_REQUIRED", "Identity challenge response is required.");
  }

  return {
    governanceCommitment,
    challengeToken,
    challengeResponse
  };
}

export function issueIdentityChallenge(options: IssueIdentityChallengeOptions = {}): IdentityChallenge {
  const now = options.now ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? parseSeconds(process.env.HUMANONLY_IDENTITY_CHALLENGE_TTL_SECONDS, DEFAULT_CHALLENGE_TTL_SECONDS);
  const minSolveSeconds = options.minSolveSeconds ?? parseSeconds(process.env.HUMANONLY_IDENTITY_CHALLENGE_MIN_SOLVE_SECONDS, DEFAULT_MIN_SOLVE_SECONDS);

  const phraseIndex =
    options.phraseIndex !== undefined
      ? Math.max(0, Math.min(CHALLENGE_PHRASES.length - 1, options.phraseIndex))
      : Math.floor(Math.random() * CHALLENGE_PHRASES.length);

  const challengeText = CHALLENGE_PHRASES[phraseIndex] as string;
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const minSolveAt = new Date(now.getTime() + minSolveSeconds * 1000).toISOString();

  const payload: ChallengeTokenPayload = {
    v: 1,
    nonce,
    answerHash: hashChallengeResponse(challengeText, nonce),
    issuedAt,
    expiresAt,
    minSolveAt
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const secret = resolveSecret(options.secret);
  const signature = signPayload(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    prompt: 'Type the phrase exactly as shown to complete human verification.',
    challengeText,
    issuedAt,
    expiresAt,
    minSolveAt
  };
}

export function verifyIdentityAssuranceEvidence(
  evidence: IdentityAssuranceEvidenceInput,
  options: VerifyIdentityAssuranceOptions = {}
): IdentityAssuranceProfile {
  if (!evidence.governanceCommitment) {
    throw new IdentityAssuranceError(
      "GOVERNANCE_COMMITMENT_REQUIRED",
      "Governance commitment is required for identity assurance."
    );
  }

  const secret = resolveSecret(options.secret);
  const payload = parsePayload(evidence.challengeToken, secret);
  const now = options.now ?? new Date();

  const expiresAtMs = Date.parse(payload.expiresAt);
  const minSolveAtMs = Date.parse(payload.minSolveAt);

  if (Number.isNaN(expiresAtMs) || Number.isNaN(minSolveAtMs)) {
    throw new IdentityAssuranceError("CHALLENGE_INVALID", "Challenge timestamps are invalid");
  }

  if (now.getTime() > expiresAtMs) {
    throw new IdentityAssuranceError("CHALLENGE_EXPIRED", "Identity challenge has expired");
  }

  if (now.getTime() < minSolveAtMs) {
    throw new IdentityAssuranceError(
      "CHALLENGE_TOO_FAST",
      "Identity challenge was completed too quickly; request a new challenge."
    );
  }

  const actualHash = hashChallengeResponse(evidence.challengeResponse, payload.nonce);
  const expectedHash = payload.answerHash;

  const actualBuffer = Buffer.from(actualHash);
  const expectedBuffer = Buffer.from(expectedHash);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new IdentityAssuranceError("CHALLENGE_MISMATCH", "Identity challenge response did not match");
  }

  return {
    level: "enhanced",
    signals: ["attestation", "governance_commitment", "interactive_challenge"],
    evaluatedAt: now.toISOString()
  };
}
