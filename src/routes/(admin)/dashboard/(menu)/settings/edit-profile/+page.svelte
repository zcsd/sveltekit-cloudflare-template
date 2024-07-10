<script>
  import { WEBSITE_NAME } from "$config";
  import SettingsModule from "../settings_module.svelte";
  import { getContext } from "svelte";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("settings");

  export let data;
  let { user } = data;
</script>

<svelte:head>
  <title>Profile - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Settings</h1>

<SettingsModule
  editable={true}
  title="Edit Profile"
  success_title="Saved Profile"
  form_target="/dashboard/api?/update_profile"
  fields={[
    {
      id: "nickname",
      label: "Name",
      initial_value: user?.nickname ?? "",
      placeholder: "Your name",
      max_length: 30,
    },
    {
      id: "organization",
      label: "Organization",
      initial_value: user?.organization ?? "",
      placeholder: "Organization name",
      max_length: 30,
    },
  ]}
/>
