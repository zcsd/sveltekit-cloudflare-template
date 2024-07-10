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
  <title>Change Email - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Settings</h1>
<!-- Change Email function is not implemented, only for view -->
<SettingsModule
  title="Change Email"
  editable={true}
  success_title="Email change initiated"
  success_body="You should recieve an email at new email address to confirm the change. Please click the link in the email to finalized the change. Until finalized, you must sign in with your current email."
  form_target="/dashboard/api?/update_email"
  fields={[
    {
      id: "email",
      label: "Email",
      initial_value: user?.email ?? "",
      placeholder: "New Email Address",
    },
  ]}
/>
