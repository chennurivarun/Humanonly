"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type OnboardingChallenge = {
  token: string;
  prompt: string;
  challengeText: string;
  issuedAt: string;
  expiresAt: string;
  minSolveAt: string;
};

export default function OnboardingPage() {
  const callbackUrl = "/";

  const [challenge, setChallenge] = useState<OnboardingChallenge | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function loadChallenge() {
    setIsLoadingChallenge(true);
    setChallengeError(null);

    try {
      const response = await fetch("/api/onboarding/challenge", {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Challenge request failed (${response.status})`);
      }

      const payload = (await response.json()) as { data?: OnboardingChallenge };
      if (!payload.data) {
        throw new Error("Challenge payload missing");
      }

      setChallenge(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load identity challenge";
      setChallengeError(message);
      setChallenge(null);
    } finally {
      setIsLoadingChallenge(false);
    }
  }

  useEffect(() => {
    void loadChallenge();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!challenge) {
      setError("Identity challenge is unavailable. Refresh challenge and try again.");
      return;
    }

    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    const result = await signIn("credentials", {
      handle: String(formData.get("handle") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      humanAttestation: String(formData.get("humanAttestation") ?? ""),
      governanceCommitment: formData.get("governanceCommitment") ? "yes" : "no",
      challengeToken: challenge.token,
      challengeResponse: String(formData.get("challengeResponse") ?? ""),
      callbackUrl,
      redirect: false
    });

    setIsPending(false);

    if (!result || result.error) {
      setError(
        "Onboarding failed. Confirm attestation, governance commitment, and identity challenge response."
      );
      await loadChallenge();
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <main>
      <section className="card" style={{ maxWidth: "640px", margin: "0 auto" }}>
        <p className="badge">Auth scaffold · Sprint 4</p>
        <h1 style={{ marginTop: "0.75rem" }}>Human onboarding</h1>
        <p className="text-muted">
          Create a local session for MVP testing. Handles in <code>HUMANONLY_ADMIN_HANDLES</code> or
          <code>HUMANONLY_MODERATOR_HANDLES</code> receive elevated roles.
        </p>

        <form onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" name="displayName" type="text" minLength={2} maxLength={60} required />
          </div>

          <div className="field">
            <label htmlFor="handle">Handle (lowercase letters, numbers, underscore)</label>
            <input id="handle" name="handle" type="text" pattern="[a-z0-9_]{3,24}" required />
          </div>

          <div className="field">
            <label htmlFor="humanAttestation">Type &quot;yes&quot; to attest you are human</label>
            <input id="humanAttestation" name="humanAttestation" type="text" placeholder="yes" required />
          </div>

          <div className="field" style={{ marginBottom: "0.6rem" }}>
            <label className="text-small" style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
              <input id="governanceCommitment" name="governanceCommitment" type="checkbox" value="yes" required />
              I commit to human expression only and human-governed decisions.
            </label>
          </div>

          <div className="field">
            <label htmlFor="challengeResponse">Identity challenge</label>
            <p className="text-small text-muted" style={{ marginTop: 0 }}>
              {challenge?.prompt ?? "Loading challenge..."}
            </p>
            <div className="notice" style={{ marginBottom: "0.65rem" }}>
              <strong>{challenge?.challengeText ?? "…"}</strong>
            </div>
            <input
              id="challengeResponse"
              name="challengeResponse"
              type="text"
              placeholder="Type the phrase exactly"
              minLength={3}
              required
              disabled={!challenge || isLoadingChallenge}
            />
          </div>

          {challenge ? (
            <p className="text-small text-muted" style={{ marginTop: 0 }}>
              Challenge expires at {new Date(challenge.expiresAt).toLocaleTimeString("en-IN")}
            </p>
          ) : null}

          {challengeError ? (
            <p
              style={{
                marginTop: 0,
                marginBottom: "0.85rem",
                color: "#1f1f1f",
                background: "#ececec",
                padding: "0.6rem",
                borderRadius: "8px"
              }}
            >
              {challengeError}
            </p>
          ) : null}

          {error ? (
            <p
              style={{
                marginTop: 0,
                marginBottom: "0.85rem",
                color: "#1f1f1f",
                background: "#ececec",
                padding: "0.6rem",
                borderRadius: "8px"
              }}
            >
              {error}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button type="submit" disabled={isPending || isLoadingChallenge || !challenge}>
              {isPending ? "Onboarding..." : "Complete onboarding"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={isLoadingChallenge || isPending}
              onClick={() => {
                void loadChallenge();
              }}
            >
              {isLoadingChallenge ? "Refreshing..." : "Refresh challenge"}
            </button>
            <a href="/" className="button secondary">
              Back
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
