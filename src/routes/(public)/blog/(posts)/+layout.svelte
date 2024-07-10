<script>
  import { page } from "$app/stores";
  import { error } from "@sveltejs/kit";
  import { sorted_blog_posts } from "./../posts";
  import { WEBSITE_NAME } from "$config";

  function get_current_post(url) {
    let search_post = null;
    for (const post of sorted_blog_posts) {
      if (url == post.link || url == post.link + "/") {
        search_post = post;
        continue;
      }
    }
    if (!search_post) {
      error(404, "Blog post not found");
    }
    return search_post;
  }
  $: current_post = get_current_post($page.url.pathname);

  function build_Ld_Json(post) {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.parsedDate?.toISOString(),
      dateModified: post.parsedDate?.toISOString(),
    };
  }
  $: json_ld_script = `<script type="application/ld+json">${
    JSON.stringify(build_Ld_Json(current_post)) + "<"
  }/script>`;

  $: pageUrl = $page.url.origin + $page.url.pathname;
</script>

<svelte:head>
  <title>{current_post.title}</title>
  <meta name="description" content={current_post.description} />

  <!-- Facebook -->
  <meta property="og:title" content={current_post.title} />
  <meta property="og:description" content={current_post.description} />
  <meta property="og:site_name" content={WEBSITE_NAME} />
  <meta property="og:url" content={pageUrl} />
  <!-- <meta property="og:image" content="https://samplesite.com/image.jpg"> -->

  <!-- Twitter -->
  <!-- “summary”, “summary_large_image”, “app”, or “player” -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={current_post.title} />
  <meta name="twitter:description" content={current_post.description} />
  <!-- <meta name="twitter:site" content="@samplesite"> -->
  <!-- <meta name="twitter:image" content="https://samplesite.com/image.jpg"> -->

  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html json_ld_script}
</svelte:head>

<article class="prose mx-auto py-12 px-6 font-sans">
  <div class="text-sm text-accent">
    {current_post.parsedDate?.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}
  </div>
  <h1>{current_post.title}</h1>
  <slot />
</article>
