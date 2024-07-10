<script>
  import { WEBSITE_NAME } from "$config";
  import { getContext } from "svelte";
  import SettingsModule from "../settings_module.svelte";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("settings");

  export let data;
  let { user } = data;
</script>

<svelte:head>
  <title>Delete Account - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Settings</h1>

<SettingsModule
  title="Delete Account"
  editable={true}
  dangerous={true}
  message="Deleting your account can not be undone. You are currently logged in as '{user?.email}'"
  save_button_title="Delete Account"
  success_title="Account queued for deletion"
  success_body="Your account will be deleted shortly."
  form_target="/dashboard/api?/delete_account"
  fields={[
    {
      id: "password",
      label: "Current Password",
      initial_value: "",
      input_type: "password",
    },
  ]}
/>
