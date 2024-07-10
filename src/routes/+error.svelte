<script>
  import "$appcss";
  import { page } from "$app/stores";
  import { WEBSITE_NAME } from "$config";
</script>

<svelte:head>
  <title>Error - {WEBSITE_NAME}</title>
</svelte:head>

<div class="hero min-h-[100vh]">
  <div class="hero-content text-center">
    <div class="max-w-lg">
      <h1 class="text-5xl font-bold">This is embarassing...</h1>
      <p class="py-6 text-2xl">{$page?.error?.message}</p>
      <div>
        <a href="/" class="btn btn-primary btn-wide">Return Home</a>
      </div>
    </div>
  </div>
</div>
