<script>
  import "$appcss";
  import { WEBSITE_NAME } from "$config";
  import { goto } from "$app/navigation";
  import { enhance, applyAction } from "$app/forms";

  export let form;
  export let data;
  let { user } = data;
  let nickname = user?.nickname ?? "";
  let organization = user?.organization ?? "";

  let is_waiting = false; // submiting form status
  let errors = {}; // form errors
  let error_message = ""; // for form error message

  const form_fields = [
    {
      id: "nickname",
      label: "Your Name",
      input_type: "text",
      placeholder: "Your name",
      max_length: 30,
      value: nickname,
      autocomplete: "off",
    },
    {
      id: "organization",
      label: "Organization",
      input_type: "text",
      placeholder: "Organization Name",
      max_length: 30,
      value: organization,
      autocomplete: "off",
    },
  ];

  const handle_submit = ({ formData, cancel }) => {
    // before form submission to server
    is_waiting = true;
    errors = {};
    error_message = "";
    const { nickname, organization } = Object.fromEntries(formData);
    if (nickname.trim().length == 0) {
      errors["nickname"] = "name is missing";
    }
    if (organization.trim().length == 0) {
      errors["organization"] = "organization is missing";
    }
    if (Object.keys(errors).length > 0) {
      error_message = "Please fill in all fields.";
      cancel();
      is_waiting = false;
    }
    // after form submission to server
    return async ({ update, result }) => {
      await update({ reset: false });
      await applyAction(result);
      is_waiting = false;
      if (result.type === "success") {
        goto("/dashboard");
      } else if (result.type === "failure") {
        errors = result.data?.errors;
        error_message = result.data?.error_message;
      }
    };
  };

  async function sign_out() {
    const response = await fetch("/dashboard/api/sign-out", { method: "POST" });
    if (response.ok) {
      goto("/");
    }
  }
</script>

<svelte:head>
  <title>Create Profile - {WEBSITE_NAME}</title>
</svelte:head>

<div
  class="text-center content-center max-w-lg mx-auto min-h-[100vh] pb-12 flex items-center place-content-center"
>
  <div class="flex flex-col w-64 lg:w-80">
    <h1
      class="text-3xl font-bold mb-6 underline decoration-secondary decoration-4"
    >
      {WEBSITE_NAME}
    </h1>
    <br />
    <div>
      <h1 class="text-xl font-bold mb-6">Create Profile</h1>
      <form
        class="form-widget"
        method="POST"
        action="/dashboard/api?/update_profile"
        use:enhance={handle_submit}
      >
        {#each form_fields as { id, label, input_type, placeholder, max_length, value, autocomplete }}
          <div class="mt-4">
            <label for={id}>
              <span class="text-l text-center font-medium">{label}</span>
            </label>
            <input
              id={id}
              name={id}
              type={input_type}
              placeholder={placeholder}
              class="{errors[id]
                ? 'input-error'
                : ''} h-10 w-full p-2 mt-1 input input-bordered max-w-xs"
              value={form?.[id] ?? value}
              maxlength={max_length}
              autocomplete={autocomplete}
            />
          </div>
        {/each}
        <div class="mt-4">
          <button
            type="submit"
            class="btn btn-primary mt-3 w-full py-2 font-bold disabled:opacity-50"
            disabled={is_waiting}
          >
            {#if is_waiting}
              <svg class="animate-spin mx-auto h-5 w-5" viewBox="0 0 50 50">
                <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="#000000" stroke-width="4"
                ></circle>
              </svg>
            {:else}
              Create Profile
            {/if}
          </button>
        </div>
        {#if error_message}
          <p class="text-error text-base text-center mt-3">
            {error_message}
          </p>
        {/if}
      </form>
      <div class="text-sm text-slate-800 mt-5">
        You are logged in as {user?.email}
        <br />
        <button class=" underline" on:click={sign_out}>Sign out</button>
      </div>
    </div>
  </div>
</div>
