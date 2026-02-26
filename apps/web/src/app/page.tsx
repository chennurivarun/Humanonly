"use client";

import { signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();

  return (
    <main>
      <section className="card" style={{ marginBottom: "1rem" }}>
        <p className="badge">Sprint 1 · Auth scaffold in progress</p>
        <h1 style={{ marginTop: "0.7rem" }}>HumanOnly MVP</h1>
        <p className="text-muted">
          Human expression only. AI-managed operations. Human-governed decisions. Every sensitive action remains
          auditable.
        </p>
      </section>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Identity status</h2>
        {status === "loading" ? (
          <p>Checking session…</p>
        ) : session?.user ? (
          <div className="grid" style={{ gap: "0.35rem" }}>
            <p>
              Signed in as <strong>{session.user.name}</strong> (@{session.user.handle})
            </p>
            <p className="text-muted">
              Role: <strong>{session.user.role}</strong> · Human verified: {session.user.humanVerified ? "yes" : "no"}
            </p>
            <div>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="secondary">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="grid" style={{ gap: "0.5rem" }}>
            <p className="text-muted">
              Join through guided onboarding before posting, reporting, or accessing moderation endpoints.
            </p>
            <div>
              <a className="button" href="/onboarding">
                Start onboarding
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-2" style={{ marginBottom: "1rem" }}>
        <article className="card">
          <h3>Core APIs</h3>
          <ul className="list">
            <li>
              <code>POST /api/posts</code> — create post (authenticated human)
            </li>
            <li>
              <code>GET /api/feed</code> — latest feed (session-aware audit)
            </li>
            <li>
              <code>POST /api/reports</code> — create report (authenticated human)
            </li>
            <li>
              <code>GET /api/reports</code> — moderation queue (moderator/admin)
            </li>
          </ul>
        </article>

        <article className="card">
          <h3>Governance guardrails</h3>
          <ul className="list">
            <li>Human attestation required during onboarding.</li>
            <li>Role-based access gate for moderation reads.</li>
            <li>Authorization denials emit audit records.</li>
            <li>Human override remains reserved for explicit admin controls.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
