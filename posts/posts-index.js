// Blog post index.
// To add a new post:
//   1. Create posts/your-slug.md with the post body (plain Markdown, no frontmatter needed)
//   2. Add one entry below — that's it, no build step, no rebuild needed
//
// `slug` must match the .md filename (without ".md") and be unique — it's used in the URL,
// e.g. slug: "coping-with-anxiety" → post.html?slug=coping-with-anxiety
const POSTS = [
  {
    slug: "starting-therapy",
    title: "What to expect when you start therapy",
    date: "2026-07-01",
    author: "WWP Counseling",
    excerpt: "First sessions can feel awkward no matter who you are. Here's what actually happens, and what doesn't."
  },
  {
    slug: "choosing-a-counselor",
    title: "How to choose a counselor who's actually a fit",
    date: "2026-06-15",
    author: "WWP Counseling",
    excerpt: "Credentials matter less than you'd think. A few things worth paying attention to instead."
  },
  {
    slug: "when-to-seek-help",
    title: "You don't need a crisis to start therapy",
    date: "2026-05-28",
    author: "WWP Counseling",
    excerpt: "A common myth is that counseling is only for emergencies. Most people who benefit from it aren't in one."
  }
];
