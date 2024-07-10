<script>
  import { WEBSITE_NAME } from "$config";
  import { getContext } from "svelte";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("home");
</script>

<svelte:head>
  <title>Dashboard - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-1">Dashboard</h1>

<div class="my-6">
  <h1 class="text-xl font-bold mb-1">Users</h1>
  <div class="stats shadow stats-vertical sm:stats-horizontal sm:w-[420px]">
    <div class="stat place-items-center">
      <div class="stat-title">Downloads</div>
      <div class="stat-value">31K</div>
      <div class="stat-desc">Jan 1st - Feb 1st</div>
    </div>
    <div class="stat place-items-center">
      <div class="stat-title">Users</div>
      <div class="stat-value">4,200</div>
      <div class="stat-desc">↗︎ 40 (2%)</div>
    </div>
  </div>
</div>
<div class="my-6">
  <h1 class="text-xl font-bold mb-1">Accounts</h1>
  <div class="stats shadow stats-vertical sm:stats-horizontal sm:w-[420px]">
    <div class="stat place-items-center">
      <div class="stat-title">New Registers</div>
      <div class="stat-value">1,200</div>
      <div class="stat-desc">↘︎ 90 (14%)</div>
    </div>
    <div class="stat place-items-center">
      <div class="stat-title">Churned Accounts</div>
      <div class="stat-value">42</div>
      <div class="stat-desc">↘︎ 6 (12%)</div>
    </div>
  </div>
</div>
<div class="my-6">
  <h1 class="text-xl font-bold mb-1">Revenue</h1>
  <div class="stats shadow stats-vertical sm:stats-horizontal sm:w-[420px]">
    <div class="stat place-items-center">
      <div class="stat-title">Revenue</div>
      <div class="stat-value text-success">$4200</div>
      <div class="stat-desc">↗︎ $180 (4%)</div>
    </div>
    <div class="stat place-items-center">
      <div class="stat-title">New Subscribers</div>
      <div class="stat-value text-secondary">16</div>
      <div class="stat-desc">↘︎ 1 (%7)</div>
    </div>
  </div>
</div>
