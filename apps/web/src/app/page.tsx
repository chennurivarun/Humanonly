"use client";

import { signOut, useSession } from "next-auth/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type FeedAuthor = {
  id: string;
  handle: string;
  displayName: string;
};

type FeedItem = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: FeedAuthor | null;
};

type FeedResponse = {
  data: FeedItem[];
  pageInfo: {
    nextCursor: string | null;
    limit: number;
  };
};

type ApiErrorPayload = {
  error?: string;
};

type AdminMetrics = {
  generatedAt: string;
  reports: {
    total: number;
    open: number;
    triaged: number;
    resolved: number;
    queueThroughputPercent: number;
  };
  appeals: {
    total: number;
    open: number;
    underReview: number;
    granted: number;
    upheld: number;
    medianResolutionHours: number | null;
  };
  trust: {
    averageScore: number;
    restricted: number;
    watch: number;
    steady: number;
    trusted: number;
  };
  overrides: {
    total: number;
    overrideRatePercent: number;
  };
};

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(parsed));
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (payload.error && typeof payload.error === "string") {
      return payload.error;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const { data: session, status } = useSession();
  const canParticipate = useMemo(
    () => Boolean(session?.user && session.user.humanVerified),
    [session?.user]
  );

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [postBody, setPostBody] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postFeedback, setPostFeedback] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const [activeReportPostId, setActiveReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [adminMetricsError, setAdminMetricsError] = useState<string | null>(null);
  const [isLoadingAdminMetrics, setIsLoadingAdminMetrics] = useState(false);

  const loadFeed = useCallback(async (mode: "replace" | "append", cursor?: string | null) => {
    if (mode === "replace") {
      setIsLoadingFeed(true);
      setFeedError(null);
    } else {
      setIsLoadingMore(true);
    }

    const query = new URLSearchParams({ limit: "10" });
    if (cursor) {
      query.set("cursor", cursor);
    }

    try {
      const response = await fetch(`/api/feed?${query.toString()}`, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as FeedResponse;
      const next = payload.pageInfo?.nextCursor ?? null;
      const rows = Array.isArray(payload.data) ? payload.data : [];

      setFeed((previous) => (mode === "append" ? [...previous, ...rows] : rows));
      setNextCursor(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load feed";
      setFeedError(message);
    } finally {
      if (mode === "replace") {
        setIsLoadingFeed(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, []);

  const loadAdminMetrics = useCallback(async () => {
    if (session?.user?.role !== "admin") {
      setAdminMetrics(null);
      setAdminMetricsError(null);
      return;
    }

    setIsLoadingAdminMetrics(true);
    setAdminMetricsError(null);

    try {
      const response = await fetch("/api/admin/metrics", {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as { data?: AdminMetrics };
      setAdminMetrics(payload.data ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load admin metrics";
      setAdminMetricsError(message);
    } finally {
      setIsLoadingAdminMetrics(false);
    }
  }, [session?.user?.role]);

  useEffect(() => {
    void loadFeed("replace");
  }, [loadFeed]);

  useEffect(() => {
    void loadAdminMetrics();
  }, [loadAdminMetrics]);

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPostError(null);
    setPostFeedback(null);
    setIsCreatingPost(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ body: postBody })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setPostBody("");
      setPostFeedback("Post published to the feed.");
      await loadFeed("replace");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to publish post";
      setPostError(message);
    } finally {
      setIsCreatingPost(false);
    }
  }

  async function handleSubmitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeReportPostId) {
      return;
    }

    setReportError(null);
    setReportFeedback(null);
    setIsSubmittingReport(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          postId: activeReportPostId,
          reason: reportReason
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setReportFeedback("Report submitted for moderator review.");
      setReportReason("");
      setActiveReportPostId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit report";
      setReportError(message);
    } finally {
      setIsSubmittingReport(false);
    }
  }

  return (
    <main className="stack-lg">
      <section className="card stack-md">
        <p className="badge">Sprint 1 · Basic UI delivered</p>
        <h1>HumanOnly MVP</h1>
        <p className="text-muted">
          Human expression only. AI-managed operations. Human-governed decisions. Every
          enforcement-sensitive action remains auditable.
        </p>
      </section>

      <section className="card stack-md">
        <h2>Identity status</h2>
        {status === "loading" ? (
          <p>Checking session…</p>
        ) : session?.user ? (
          <div className="stack-sm">
            <p>
              Signed in as <strong>{session.user.name}</strong> (@{session.user.handle})
            </p>
            <p className="text-muted">
              Role: <strong>{session.user.role}</strong> · Human verified: {session.user.humanVerified ? "yes" : "no"}
            </p>
            <div className="row">
              <button onClick={() => signOut({ callbackUrl: "/" })} className="secondary" type="button">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <p className="text-muted">
              Join through guided onboarding before posting or reporting.
            </p>
            <div className="row">
              <a className="button" href="/onboarding">
                Start onboarding
              </a>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-2">
        <article className="card stack-sm">
          <h3>Create post</h3>
          <p className="text-muted">Only authenticated, human-verified accounts can publish.</p>

          {canParticipate ? (
            <form className="stack-sm" onSubmit={handleCreatePost}>
              <label htmlFor="postBody">Post body</label>
              <textarea
                id="postBody"
                name="postBody"
                maxLength={500}
                minLength={1}
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
                placeholder="Share your human perspective"
                required
              />
              <div className="row spread">
                <p className="text-muted text-small">{postBody.trim().length}/500</p>
                <button type="submit" disabled={isCreatingPost}>
                  {isCreatingPost ? "Publishing..." : "Publish post"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-muted">Complete onboarding to create posts.</p>
          )}

          {postFeedback ? <p className="notice">{postFeedback}</p> : null}
          {postError ? <p className="notice danger">{postError}</p> : null}
        </article>

        <article className="card stack-sm">
          <h3>Governance controls</h3>
          <ul className="list">
            <li>Human authorship is required for publishing and reporting.</li>
            <li>AI remains constrained to operational workflows and observability.</li>
            <li>Moderation queue access is role-gated to moderator/admin sessions.</li>
            <li>Admin override remains explicit, auditable, and human-confirmed.</li>
          </ul>
        </article>
      </section>

      {session?.user?.role === "admin" ? (
        <section className="card stack-md">
          <div className="row spread align-center">
            <h2>Admin metrics</h2>
            <button type="button" className="secondary" onClick={() => void loadAdminMetrics()} disabled={isLoadingAdminMetrics}>
              {isLoadingAdminMetrics ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {adminMetricsError ? <p className="notice danger">{adminMetricsError}</p> : null}

          {adminMetrics ? (
            <div className="grid grid-2">
              <article className="post-card stack-sm">
                <h3>Reports</h3>
                <p className="text-small text-muted">Total: {adminMetrics.reports.total}</p>
                <p className="text-small text-muted">Open: {adminMetrics.reports.open}</p>
                <p className="text-small text-muted">Triaged: {adminMetrics.reports.triaged}</p>
                <p className="text-small text-muted">Resolved: {adminMetrics.reports.resolved}</p>
                <p className="text-small text-muted">Queue throughput: {adminMetrics.reports.queueThroughputPercent}%</p>
              </article>

              <article className="post-card stack-sm">
                <h3>Appeals</h3>
                <p className="text-small text-muted">Total: {adminMetrics.appeals.total}</p>
                <p className="text-small text-muted">Open: {adminMetrics.appeals.open}</p>
                <p className="text-small text-muted">Under review: {adminMetrics.appeals.underReview}</p>
                <p className="text-small text-muted">Granted: {adminMetrics.appeals.granted}</p>
                <p className="text-small text-muted">Upheld: {adminMetrics.appeals.upheld}</p>
                <p className="text-small text-muted">
                  Median resolution: {adminMetrics.appeals.medianResolutionHours ?? "-"}h
                </p>
              </article>

              <article className="post-card stack-sm">
                <h3>Trust distribution</h3>
                <p className="text-small text-muted">Average score: {adminMetrics.trust.averageScore}</p>
                <p className="text-small text-muted">Restricted: {adminMetrics.trust.restricted}</p>
                <p className="text-small text-muted">Watch: {adminMetrics.trust.watch}</p>
                <p className="text-small text-muted">Steady: {adminMetrics.trust.steady}</p>
                <p className="text-small text-muted">Trusted: {adminMetrics.trust.trusted}</p>
              </article>

              <article className="post-card stack-sm">
                <h3>Overrides</h3>
                <p className="text-small text-muted">Total override-adjacent actions: {adminMetrics.overrides.total}</p>
                <p className="text-small text-muted">Override rate: {adminMetrics.overrides.overrideRatePercent}%</p>
                <p className="text-small text-muted">Generated: {formatTimestamp(adminMetrics.generatedAt)}</p>
              </article>
            </div>
          ) : (
            <p className="text-muted">No metrics available yet.</p>
          )}
        </section>
      ) : null}

      <section className="card stack-md">
        <div className="row spread align-center">
          <h2>Feed</h2>
          <button type="button" className="secondary" onClick={() => void loadFeed("replace")} disabled={isLoadingFeed}>
            {isLoadingFeed ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {feedError ? <p className="notice danger">{feedError}</p> : null}

        {isLoadingFeed && feed.length === 0 ? <p>Loading feed…</p> : null}

        {!isLoadingFeed && feed.length === 0 ? <p className="text-muted">No posts yet. Publish the first human update.</p> : null}

        <div className="stack-sm">
          {feed.map((post) => {
            const isReportingThisPost = activeReportPostId === post.id;

            return (
              <article key={post.id} className="post-card stack-sm">
                <header className="row spread align-center">
                  <p className="post-author">
                    <strong>{post.author?.displayName ?? "Unknown user"}</strong>{" "}
                    <span className="text-muted">@{post.author?.handle ?? post.authorId}</span>
                  </p>
                  <p className="text-muted text-small">{formatTimestamp(post.createdAt)}</p>
                </header>

                <p className="post-body">{post.body}</p>

                {canParticipate ? (
                  <div className="stack-sm">
                    <div className="row">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setReportError(null);
                          setReportFeedback(null);
                          if (isReportingThisPost) {
                            setActiveReportPostId(null);
                            setReportReason("");
                          } else {
                            setActiveReportPostId(post.id);
                            setReportReason("");
                          }
                        }}
                      >
                        {isReportingThisPost ? "Cancel report" : "Report post"}
                      </button>
                    </div>

                    {isReportingThisPost ? (
                      <form className="stack-sm" onSubmit={handleSubmitReport}>
                        <label htmlFor={`report-${post.id}`}>Reason for report</label>
                        <textarea
                          id={`report-${post.id}`}
                          name="reason"
                          maxLength={500}
                          minLength={4}
                          value={reportReason}
                          onChange={(event) => setReportReason(event.target.value)}
                          placeholder="Describe the policy concern"
                          required
                        />
                        <div className="row spread">
                          <p className="text-muted text-small">{reportReason.trim().length}/500</p>
                          <button type="submit" disabled={isSubmittingReport}>
                            {isSubmittingReport ? "Submitting..." : "Submit report"}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {reportFeedback ? <p className="notice">{reportFeedback}</p> : null}
        {reportError ? <p className="notice danger">{reportError}</p> : null}

        {nextCursor ? (
          <div className="row">
            <button type="button" className="secondary" onClick={() => void loadFeed("append", nextCursor)} disabled={isLoadingMore}>
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
