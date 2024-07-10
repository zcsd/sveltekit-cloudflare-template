<script>
  import { WEBSITE_NAME } from "$config";
  import { enhance, applyAction } from "$app/forms";

  export let data;
  const { hidden_email } = data; // hidden_email is passed from the server, to display the email that is being changed password

  let error_message = ""; // for form error message,
  let show_success = false;
  let is_waiting = false; // for button loading circle
  let is_disabled = false; // for button disabled

  const form_fields = [
    {
      id: "password",
      label: "New Password",
      input_type: "password",
      autocomplete: "off",
    },
    {
      id: "confirm_password",
      label: "Confirm New Password",
      input_type: "password",
      autocomplete: "off",
    },
  ];

  function clear_passwords() {
    document.getElementById("password").value = "";
    document.getElementById("confirm_password").value = "";
  }

  const handle_submit = ({ formData, cancel }) => {
    // before form submission to server
    is_waiting = true;
    is_disabled = true;
    show_success = false;
    error_message = "";
    const { password, confirm_password } = Object.fromEntries(formData);
    if (password != confirm_password) {
      error_message = "Passwords do not match, please re-enter.";
      clear_passwords();
    }
    if (password.trim().length < 8 || confirm_password.trim().length < 8) {
      error_message = "Passwords must be at least 8 characters.";
      clear_passwords();
    }
    if (password.trim().length == 0 || confirm_password.trim().length == 0) {
      error_message = "Please fill in both password fields.";
    }
    if (error_message) {
      cancel();
      is_waiting = false;
      is_disabled = false;
    }
    // after form submission to server
    return async ({ result, update }) => {
      //await update({ reset: false }); // can not use update here, it will reload the page
      await applyAction(result);
      is_waiting = false;
      if (result.type === "success") {
        show_success = true;
        is_disabled = true;
      } else if (result.type === "failure") {
        error_message = result.data?.error_message;
        is_disabled = false;
        clear_passwords();
      }
    };
  };
</script>

<svelte:head>
  <title>Change Password - {WEBSITE_NAME}</title>
</svelte:head>

{#if show_success}
  <div
    class="text-center content-center max-w-lg mx-auto min-h-[100vh] pb-12 flex items-center place-content-center"
  >
    <div class="flex flex-col w-auto">
      <h1
        class="text-3xl font-bold mb-6 underline decoration-secondary decoration-4"
      >
        {WEBSITE_NAME}
      </h1>
      <br />
      <div class="flex items-center justify-center p-4">
        <div class="text-center p-6 w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12 mx-auto mb-3 text-success"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <h2 class="text-xl font-bold mb-6 mt-2">Password Changed</h2>
          <p class="mb-6 text-base">
            You have successfully changed your password.
          </p>
          <a href="/sign-in" class="btn btn-primary text-base font-bold w-full">
            Go to sign in →
          </a>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div
    class="text-center content-center max-w-lg mx-auto min-h-[100vh] pb-12 flex items-center place-content-center"
  >
    <div class="flex flex-col w-64 md:w-80">
      <h1
        class="text-3xl font-bold mb-6 underline decoration-secondary decoration-4"
      >
        {WEBSITE_NAME}
      </h1>
      <br />

      <div>
        <h1 class="text-xl font-bold mb-6">Create New Password</h1>
        <form
          class="form-widget"
          method="POST"
          action=""
          use:enhance={handle_submit}
        >
          {#each form_fields as { id, label, input_type, autocomplete }}
            <div class="mt-4">
              <label for={id}>
                <span class="text-l text-center font-medium">{label}</span>
              </label>
              <input
                id={id}
                name={id}
                type={input_type}
                autocomplete={autocomplete}
                class="h-10 w-full p-2 mt-1 input input-bordered max-w-xs"
              />
            </div>
          {/each}
          <div class="mt-4">
            <button
              type="submit"
              class="btn btn-primary w-full py-2 font-bold disabled:opacity-50"
              disabled={is_disabled}
            >
              {#if is_waiting}
                <svg class="animate-spin mx-auto h-5 w-5" viewBox="0 0 50 50">
                  <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="#000000" stroke-width="4"
                  ></circle>
                </svg>
              {:else}
                Change Password
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
          You are changing the password for {hidden_email}
          <br />
        </div>
      </div>
    </div>
  </div>
{/if}
