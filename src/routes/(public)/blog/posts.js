import { WEBSITE_NAME } from "$config";

export const blog_info = {
  name: WEBSITE_NAME + " Blog",
  description: "A sample blog",
};

// Update this list with the actual blog post list
// Create a page in the "(posts)" directory for each entry
const blog_posts = [
  {
    title: "Example Blog Post 3",
    description: "Even more example content, check it out!",
    link: "/blog/wonderful-post",
    date: "2024-01-20",
  },
  {
    title: "Example Blog Post 2",
    description: "More example content, check it out!",
    link: "/blog/awesome-post",
    date: "2023-12-23",
  },
  {
    title: "Example Blog Post",
    description:
      "A sample blog post, showing the blog post list and individual post pages.",
    link: "/blog/example-post",
    date: "2023-11-13",
  },
];

// Parse post dates from strings to Date objects
for (const post of blog_posts) {
  if (!post.parsedDate) {
    const dateParts = post.date.split("-");
    post.parsedDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    ); // Note: months are 0-based
  }
}

export const sorted_blog_posts = blog_posts.sort(
  (a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0)
);
