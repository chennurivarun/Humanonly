"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function OnboardingPage() {
  const callbackUrl = "/";

  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);

    const result = await signIn("credentials", {
      handle: String(formData.get("handle") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      humanAttestation: String(formData.get("humanAttestation") ?? ""),
      callbackUrl,
      redirect: false
    });

    setIsPending(false);

    if (!result || result.error) {
      setError("Onboarding failed. Check handle format and confirm the human attestation.");
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <main>
      <section className="card" style={{ maxWidth: "640px", margin: "0 auto" }}>
        <p className="badge">Auth scaffold · Sprint 1</p>
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

          {error ? (
            <p style={{ marginTop: 0, marginBottom: "0.85rem", color: "#1f1f1f", background: "#ececec", padding: "0.6rem", borderRadius: "8px" }}>
              {error}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button type="submit" disabled={isPending}>
              {isPending ? "Onboarding..." : "Complete onboarding"}
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
