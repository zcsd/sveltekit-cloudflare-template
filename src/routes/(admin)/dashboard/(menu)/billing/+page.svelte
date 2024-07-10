<script>
  import { WEBSITE_NAME } from "$config";
  import { getContext } from "svelte";
  import SettingsModule from "../settings/settings_module.svelte";
  import PricingModule from "../../../../(public)/pricing/pricing_module.svelte";
  import {
    pricing_plans,
    default_plan_id,
  } from "../../../../(public)/pricing/pricing_plans";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("billing");

  export let data;

  let current_plan_id = data.current_plan_id ?? default_plan_id;
  let current_plan_name = pricing_plans.find(
    (x) => x.id === data.current_plan_id
  )?.name;
</script>

<svelte:head>
  <title>Billing - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-2">
  {data.is_active_subscription ? "Billing" : "Select a Plan"}
</h1>
<div>
  View our <a href="/pricing" target="_blank" class="link">pricing page</a> for details.
</div>

{#if !data.is_active_subscription}
  <div class="mt-8">
    <PricingModule {current_plan_id} call_to_action="Select Plan" center={false} />
  </div>

  {#if data.had_subscription_before}
    <div class="mt-10">
      <a href="/dashboard/billing/manage" class="link">View past invoices</a>
    </div>
  {/if}
{:else}
  <SettingsModule
    title="Subscription"
    editable={false}
    fields={[
      {
        id: "plan",
        label: "Current Plan",
        initial_value: current_plan_name || "",
      },
    ]}
    edit_button_title="Manage Subscripton"
    edit_link="/dashboard/billing/manage"
  />
{/if}
