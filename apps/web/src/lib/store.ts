export type Post = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Report = {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  status: "open" | "triaged" | "resolved";
  createdAt: string;
};

const posts: Post[] = [];
const reports: Report[] = [];

export const db = {
  posts,
  reports
};
