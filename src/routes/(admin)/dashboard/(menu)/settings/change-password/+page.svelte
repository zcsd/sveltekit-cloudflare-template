<script>
  import { WEBSITE_NAME } from "$config";
  import { getContext } from "svelte";
  import SettingsModule from "../settings_module.svelte";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("settings");
</script>

<svelte:head>
  <title>Change Password - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Change Password</h1>

<SettingsModule
  title="Change Password"
  editable={true}
  save_button_title="Change Password"
  success_title="Password Changed Successfully"
  success_body="On next sign in, use your new password."
  form_target="/dashboard/api?/update_password"
  fields={[
    {
      id: "password",
      label: "New Password",
      initial_value: "",
      input_type: "password",
    },
    {
      id: "confirm_password",
      label: "Confirm New Password",
      initial_value: "",
      input_type: "password",
    },
    {
      id: "current_password",
      label: "Current Password",
      initial_value: "",
      input_type: "password",
    },
  ]}
/>
