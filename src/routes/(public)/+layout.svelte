<script>
  import "$appcss";
  import { WEBSITE_NAME } from "$config";
</script>

<div class="navbar bg-base-100 container mx-auto">
  <div class="flex-1">
    <a class="mx-4 normal-case text-2xl font-bold" href="/">
      {WEBSITE_NAME}
    </a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1 hidden sm:flex">
      <li class="sm:mx-1">
        <a href="/blog" class="btn btn-ghost text-base font-bold">Blog</a>
      </li>
      <li class="sm:mx-1">
        <a href="/pricing" class="btn btn-ghost text-base font-bold">Pricing</a>
      </li>
      <li class="sm:mx-1">
        <a
          href="/sign-in"
          class="btn btn-outline btn-primary text-base font-bold">Sign In</a
        >
      </li>
      <li class="sm:mx-1">
        <a href="/sign-up" class="btn btn-primary text-base font-bold"
          >Sign Up</a
        >
      </li>
    </ul>
    <div class="dropdown dropdown-end sm:hidden">
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <label tabindex="0" class="btn btn-ghost btn-circle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h7"
          /></svg
        >
      </label>
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <ul
        tabindex="0"
        class="menu menu-lg dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-40 font-bold space-y-1"
      >
        <li>
          <a href="/blog" class="btn btn-ghost text-base font-bold">Blog</a>
        </li>
        <li>
          <a href="/pricing" class="btn btn-ghost text-base font-bold"
            >Pricing</a
          >
        </li>
        <li>
          <a
            href="/sign-in"
            class="btn btn-outline btn-primary text-base font-bold">Sign In</a
          >
        </li>
        <li>
          <a href="/sign-up" class="btn btn-primary text-base font-bold"
            >Sign Up</a
          >
        </li>
      </ul>
    </div>
  </div>
</div>

<div class="">
  <slot />
</div>

<!-- Spacer grows so the footer can be at bottom on short pages -->
<div>
  <div class="border-t max-w-[1000px] mx-auto"></div>
  <footer
    class="footer p-10 gap-x-48 lg:gap-x-64 xl:gap-x-96 place-content-center text-base"
  >
    <nav>
      <span class="footer-title opacity-80">Explore</span>
      <a class="link link-hover my-1" href="/pricing">Pricing</a>
      <a class="link link-hover my-1" href="/blog">Blog</a>
      <a class="link link-hover my-1" href="/contact-us">Contact Us</a>
      <a
        class="link link-hover my-1"
        href="https://github.com/zcsd/sveltekit-cloudflare-template"
        target="_blank">GitHub</a
      >
      <a class="link link-hover mb-1" href="/terms">Terms</a>
    </nav>
    <aside>
      <span class="footer-title opacity-80">Website</span>
      <a href="/" class="link link-hover max-w-[260px]">
        <img
          src="/images/logo-small-black.svg"
          class="w-[200px] mb-3"
          alt="Logo"
        />
        Welcome to {WEBSITE_NAME}. I hope you can find what you are looking for.
      </a>
      <p>Copyright © 2024 - All rights reserved</p>
    </aside>
  </footer>
</div>
