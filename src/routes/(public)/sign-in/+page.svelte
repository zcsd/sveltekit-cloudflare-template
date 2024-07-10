<script>
  import { WEBSITE_NAME, TURNSTILE_SITEKEY } from "$config";
  import { enhance, applyAction } from "$app/forms";
  import { Turnstile } from "svelte-turnstile";
  import { browser } from "$app/environment";

  export let form;

  let error_message = ""; // for form error message, display on top of form
  let is_waiting = false; // submiting form status

  const form_fields = [
    {
      id: "email",
      label: "Email",
      input_type: "email",
      autocomplete: "email",
    },
    {
      id: "password",
      label: "Password",
      input_type: "password",
      autocomplete: "off",
    },
  ];

  function clear_passwords() {
    document.getElementById("password").value = "";
  }

  const handle_submit = ({ formElement, formData, action, cancel, submitter }) => {
    // before form submission to server
    is_waiting = true;
    error_message = "";
    const { email, password } = Object.fromEntries(formData);
    const turnstile_token = formData.get("cf-turnstile-response");
    if (
      email.trim().length < 3 ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      error_message = "Invalid email or password, please re-enter and try again.";
    }
    if (email.trim().length == 0) {
      error_message = "Email is missing, please enter your email address.";
    }
    if (password.trim().length == 0) {
      error_message = "Password is missing, please enter your password.";
    }
    if (!turnstile_token && !error_message) {
      error_message = "Please complete the CAPTCHA human verification before submitting.";
    }
    if (error_message) {
      cancel();
      is_waiting = false;
    }
    // after form submission to server
    return async ({ result, update }) => {
      //await update({ reset: false });
      await applyAction(result);
      if (result.type === "failure") {
        is_waiting = false;
        clear_passwords();
        error_message = result.data?.error_message;
      }
    };
  };

  $: if (browser && form) reset?.();
  let reset;
</script>

<svelte:head>
  <title>Sign In - {WEBSITE_NAME}</title>
</svelte:head>

<div class="container relative flex-col mx-auto my-4">
  <div class="flex flex-col items-center justify-center lg:p-8">
    <div
      class="mx-auto flex w-full flex-col justify-center items-center space-y-4 sm:w-[350px]"
    >
      <form method="POST" action="" use:enhance={handle_submit}>
        <div
          class="max-w-sm mx-auto p-6 rounded-lg md:card md:card-bordered md:shadow-lg space-y-6 mt-5 min-w-[350px]"
        >
          <h1 class="text-2xl font-bold mb-2">Sign In</h1>
          <p class="mb-4">
            Don't have an account? <a href="/sign-up" class="underline"
              >Sign up</a
            >
          </p>
          {#if error_message}
            <div role="alert" class="px-2 border-l-4 border-error text-error">
              {error_message}
            </div>
          {/if}
          {#each form_fields as { id, label, input_type, autocomplete }}
            <div>
              <label for={id} class="block text-base font-medium">{label}</label
              >
              <input
                id={id}
                name={id}
                type={input_type}
                autocomplete={autocomplete}
                class="h-10 w-full p-2 mt-1 input input-bordered"
              />
            </div>
          {/each}
          <div>
            <a href="/forgot-password" class="underline">Forgot password?</a>
          </div>
          <div class="turnstile-container">
            <Turnstile siteKey={TURNSTILE_SITEKEY} theme="light" bind:reset />
          </div>
          <button
            type="submit"
            class="btn btn-primary w-full py-2 font-bold disabled:opacity-50"
            disabled={is_waiting}
          >
            {#if is_waiting}
              <svg class="animate-spin mx-auto h-5 w-5" viewBox="0 0 50 50">
                <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="#000000" stroke-width="4"
                ></circle>
              </svg>
            {:else}
              Sign In
            {/if}
          </button>
          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-base">
              <span class="px-2 bg-white text-gray-500">OR</span>
            </div>
          </div>
          <a class="btn btn-outline btn-primary text-base font-bold w-full py-2" href="/passwordless-sign-in">&#x1F517; Email Me A Magic Link</a>
        </div>
      </form>
    </div>
  </div>
</div>
