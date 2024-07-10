<script>
  import { WEBSITE_NAME, TURNSTILE_SITEKEY } from "$config";
  import { enhance, applyAction } from "$app/forms";
  import toast, { Toaster } from "svelte-french-toast";
  import { Turnstile } from "svelte-turnstile";
  import { browser } from "$app/environment";

  export let form;

  let errors = {}; // for form error messages for each field, display on each field
  let error_message = ""; // for form error message, display on top of form
  let is_waiting = false; // submiting form status
  let show_success = false;

  const form_fields = [
    {
      id: "referral_code",
      label: "Referral Code",
      input_type: "text",
      autocomplete: "off",
    },
    {
      id: "email",
      label: "Email *",
      input_type: "email",
      autocomplete: "email",
    },
    {
      id: "password",
      label: "Password *",
      input_type: "password",
      autocomplete: "off",
    },
    {
      id: "confirm_password",
      label: "Confirm Password *",
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
    errors = {};
    error_message = "";
    show_success = false;
    const { referral_code, email, password, confirm_password } =
      Object.fromEntries(formData);
    const turnstile_token = formData.get("cf-turnstile-response");
    if (
      email.trim().length < 3 ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      errors["email"] = "invalid email";
    }
    if (email.trim().length == 0) {
      errors["email"] = "required";
    }
    if (password != confirm_password) {
      errors["password"] = "not matching";
      errors["confirm_password"] = "not matching";
      clear_passwords();
    }
    if (password.trim().length < 8) {
      errors["password"] = "too short";
      clear_passwords();
    }
    if (password.trim().length == 0) {
      errors["password"] = "required";
    }
    if (confirm_password.trim().length < 8) {
      errors["confirm_password"] = "too short";
      clear_passwords();
    }
    if (confirm_password.trim().length == 0) {
      errors["confirm_password"] = "required";
    }
    if (Object.values(errors).length > 0) {
      error_message = "Please resolve issues and submit again. ";
      if (password.length < 8 || confirm_password.length < 8) {
        error_message += "Password must be at least 8 characters. ";
      }
    }
    if (!turnstile_token && !error_message) {
      error_message = "Please complete the CAPTCHA human verification.";
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
      clear_passwords();
      if (result.type === "success") {
        show_success = true;
        toast.success("Verification email has been sent.", {duration: 5000});
      } else if (result.type === "failure") {
        errors = result.data?.errors ?? {};
        error_message = result.data?.error_message;
      }
    };
  };
  // for turnstile
  $: if (browser && form) reset?.();
  let reset;
</script>

<Toaster />

<svelte:head>
  <title>Sign Up - {WEBSITE_NAME}</title>
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
      <p class="mb-1 text-base">
        We just sent a verification link to {form?.email ?? "your email"}.
      </p>
      <p class="mb-6 text-base">Verify your email before signing in.</p>
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
            <h1 class="text-2xl font-bold mb-2">Sign Up</h1>
            <p class="mb-4">
              Already have an account? <a href="/sign-in" class="underline"
                >Sign in</a
              >
            </p>
            {#if error_message}
              <div role="alert" class="px-2 border-l-4 border-error text-error">
                {error_message}
              </div>
            {/if}
            {#each form_fields as { id, label, input_type, autocomplete }}
              <div>
                <label for={id} class="block text-base font-medium">
                  {label}
                  {#if errors[id]}
                    <span class="text-error text-sm float-right font-normal">
                      {errors[id]}
                    </span>
                  {/if}
                </label>
                <input
                  id= {id}
                  name={id}
                  type={input_type}
                  autocomplete={autocomplete}
                  class="{errors[id]
                    ? 'input-error'
                    : ''} h-10 w-full p-2 mt-1 input input-bordered"
                />
              </div>
            {/each}
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
                  <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="#000000"stroke-width="4"
                  ></circle>
                </svg>
              {:else}
                Sign Up
              {/if}
            </button>
          </div>
        </form>
        <p class="px-8 text-center text-sm text-muted-foreground">
          By creating account, you agree to our
          <a href="/terms" class="underline underline-offset-4 hover:text-primary" target="_blank">
            Terms of Service
          </a>.
        </p>
      </div>
    </div>
  </div>
{/if}
