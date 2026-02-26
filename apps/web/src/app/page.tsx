export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "3rem auto", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }}>
      <h1>HumanOnly MVP API Scaffold</h1>
      <p>Phase in progress: Sprint 1 foundation APIs for posts, feed, and reports.</p>
      <ul>
        <li><code>POST /api/posts</code> — create post</li>
        <li><code>GET /api/feed</code> — latest feed with cursor pagination</li>
        <li><code>POST /api/reports</code> — create report</li>
        <li><code>GET /api/reports</code> — moderation queue</li>
      </ul>
    </main>
  );
}
