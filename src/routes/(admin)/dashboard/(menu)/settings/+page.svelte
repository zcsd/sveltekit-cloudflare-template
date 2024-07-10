<script>
  import { WEBSITE_NAME } from "$config";
  import { getContext } from "svelte";
  import SettingsModule from "./settings_module.svelte";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("settings");

  export let data;
  let { user } = data;
</script>

<svelte:head>
  <title>Settings - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Settings</h1>

<SettingsModule
  title="Email"
  editable={false}
  display_only={true}
  fields={[{ id: "email", initial_value: user?.email || "" }]}
  edit_button_title="Change Email"
  edit_link="/dashboard/settings/change-email"
/>

<SettingsModule
  title="Profile"
  editable={false}
  display_only={false}
  fields={[
    { id: "nickname", label: "Name", initial_value: user?.nickname ?? "" },
    {
      id: "organization",
      label: "Organization",
      initial_value: user?.organization ?? user?.nickname ?? "",
    },
  ]}
  edit_button_title="Edit Profile"
  edit_link="/dashboard/settings/edit-profile"
/>

<SettingsModule
  title="Password"
  editable={false}
  display_only={false}
  fields={[{ id: "password", initial_value: "••••••••••••••••" }]}
  edit_button_title="Change Password"
  edit_link="/dashboard/settings/change-password"
/>

<SettingsModule
  title="Danger Zone"
  editable={false}
  display_only={false}
  dangerous={true}
  fields={[]}
  edit_button_title="Delete Account"
  edit_link="/dashboard/settings/delete-account"
/>
