<script>
  import { WEBSITE_NAME, TURNSTILE_SITEKEY } from "$config";
  import { enhance, applyAction } from "$app/forms";
  import { Turnstile } from "svelte-turnstile";
  import { browser } from "$app/environment";

  export let form;

  let error_message = ""; // for form error message, display on top of form
  let show_success = false;
  let is_waiting = false; // submiting form status

  const handle_submit = ({ formElement, formData, action, cancel, submitter }) => {
    // before form submission to server
    is_waiting = true;
    error_message = "";
    show_success = false;
    const { email } = Object.fromEntries(formData);
    const turnstile_token = formData.get("cf-turnstile-response");
    if (
      email.trim().length < 3 ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      error_message = "You have entered an invalid email, please re-enter and try again.";
    }
    if (email.trim().length == 0) {
      error_message = "Email is missing, please enter your email and try again.";
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
      await update({ reset: false });
      await applyAction(result);
      is_waiting = false;
      if (result.type === "success") {
        show_success = true;
      } else if (result.type === "failure") {
        error_message = result.data?.error_message;
      }
    };
  };

  $: if (browser && form) reset?.(); // for turnstile reset
  let reset;
</script>

<svelte:head>
  <title>Forgot Password - {WEBSITE_NAME}</title>
</svelte:head>

{#if show_success}
  <div class="flex items-center justify-center p-4 mt-20 mb-12">
    <div
      class="text-center p-6 max-w-md w-full rounded-lg md:card md:card-bordered md:shadow-lg"
    >
      <svg
        class="w-16 h-16 mx-auto mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 8l7.89 5.26c.65.43 1.51.43 2.16 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
      <h2 class="text-xl font-semibold mb-2">Check your email</h2>
      <p class="mb-6 text-base">
        If {form?.email ?? "your email"} is registered, you will receive a password
        reset link at your email shortly.
      </p>
    </div>
  </div>
{:else}
  <div class="container relative flex-col mx-auto my-4">
    <div class="flex flex-col items-center justify-center lg:px-8">
      <div
        class="mx-auto flex w-full flex-col justify-center items-center space-y-4 sm:w-[350px]"
      >
        <form method="POST" action="" use:enhance={handle_submit}>
          <div
            class="max-w-sm mx-auto p-6 rounded-lg md:card md:card-bordered md:shadow-lg space-y-6 mt-5 min-w-[350px]"
          >
            <h1 class="text-2xl font-bold mb-2">Forgot Password</h1>
            {#if error_message}
              <div role="alert" class="px-2 border-l-4 border-error text-error">
                {error_message}
              </div>
            {/if}
            <div>
              <label for="email" class="block text-base font-medium"
                >Email</label
              >
              <input
                id="email"
                name="email"
                type="email"
                class="h-10 w-full p-2 mt-1 input input-bordered"
              />
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
                Send Reset Password Email
              {/if}
            </button>
            <div>
              <p class="mb-4">
                Remember your password? <a href="/sign-in" class="underline"
                  >Sign in</a
                >
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
