<script>
  import { WEBSITE_NAME, TURNSTILE_SITEKEY } from "$config";
  import { enhance, applyAction } from "$app/forms";
  import { Turnstile } from "svelte-turnstile";
  import { browser } from "$app/environment";

  export let form;

  let errors = {}; // for form error messages for each field, display on each field
  let error_message = ""; // for form overall error message, display on form bottom
  let is_waiting = false; // submiting form status
  let show_success = false; // if form submission is successful

  const form_fields = [
    {
      id: "contact_name",
      label: "Your Name *",
      input_type: "text",
      autocomplete: "contact_name",
    },
    {
      id: "email",
      label: "Email *",
      input_type: "email",
      autocomplete: "email",
    },
    {
      id: "phone",
      label: "Phone Number",
      input_type: "tel",
      autocomplete: "tel",
    },
    {
      id: "company",
      label: "Company Name",
      input_type: "text",
      autocomplete: "organization",
    },
    {
      id: "message",
      label: "Message",
      input_type: "textarea",
      autocomplete: "off",
    },
  ];

  const handle_submit = ({ formData, cancel }) => {
    // before form submission to server
    is_waiting = true;
    errors = {};
    error_message = "";
    const { contact_name, email } = Object.fromEntries(formData);
    const turnstile_token = formData.get("cf-turnstile-response");
    if (contact_name.trim().length == 0) {
      errors["contact_name"] = "required";
    }
    if (email.trim().length < 3 || !email.includes("@")) {
      errors["email"] = "invalid email";
    }
    if (email.trim().length == 0) {
      errors["email"] = "required";
    }
    if (Object.values(errors).length > 0) {
      error_message = "Please resolve issues and submit again.";
    }
    if (!turnstile_token && !error_message) {
      error_message = "Please complete the CAPTCHA human verification.";
    }
    if (error_message) {
      cancel();
      is_waiting = false;
    }
    // after form submission to server
    return async ({ update, result }) => {
      await update({ reset: false });
      await applyAction(result);
      is_waiting = false;
      if (result.type === "success") {
        show_success = true;
      } else if (result.type === "failure") {
        errors = result.data?.errors ?? {};
        error_message = result.data?.error_message;
      }
    };
  };

  $: if (browser && form) reset?.(); // for turnstile reset
  let reset;
</script>

<svelte:head>
  <title>Contact Us - {WEBSITE_NAME}</title>
</svelte:head>

<div
  class="flex flex-col lg:flex-row mx-auto my-4 min-h-[70vh] place-items-center lg:place-items-start place-content-center"
>
  <div
    class="max-w-[400px] lg:max-w-[500px] flex flex-col place-content-center p-4 lg:mr-8 lg:mb-8 lg:min-h-[70vh]"
  >
    <div class="px-6">
      <h1 class="text-2xl lg:text-4xl font-bold mb-4">Contact Us</h1>
      <p class="text-lg">Talk to one of our service professionals to:</p>
      <ul class="list-disc list-outside pl-6 py-4 space-y-1">
        <li class="">Get a live demo</li>
        <li class="">Discuss your specific needs</li>
        <li>Get a quote</li>
        <li>Answer any technical questions you have</li>
      </ul>
      <p>Once you complete the form, we'll reach out to you!</p>
      <p class="text-sm pt-8">
        Your information will not be shared with any third parties.
      </p>
    </div>
  </div>

  <div
    class="flex flex-col flex-grow m-4 lg:ml-10 min-w-[300px] stdphone:min-w-[350px] max-w-[350px] place-content-center lg:min-h-[70vh]"
  >
    {#if show_success}
      <div class="flex flex-col place-content-center lg:min-h-[70vh]">
        <div
          class="card card-bordered shadow-lg py-6 px-6 mx-2 lg:mx-0 lg:p-6 mb-10"
        >
          <div class="text-2xl font-bold mb-4">Thank you!</div>
          <p class="">
            Your message has been sent successfully. We will get back to you
            soon.
          </p>
        </div>
      </div>
    {:else}
      <div class="card card-bordered shadow-lg p-4 pt-6 mx-2 lg:mx-0 lg:p-6">
        <form
          class="form-widget flex flex-col"
          method="POST"
          action=""
          use:enhance={handle_submit}
        >
          {#each form_fields as field}
            <label for={field.id}>
              <div class="flex flex-row">
                <div class="text-base font-medium">{field.label}</div>
                {#if errors[field.id]}
                  <div class="text-error flex-grow text-sm ml-2 text-right">
                    {errors[field.id]}
                  </div>
                {/if}
              </div>
              {#if field.input_type === "textarea"}
                <textarea
                  id={field.id}
                  name={field.id}
                  autocomplete={field.autocomplete}
                  rows={4}
                  class="{errors[field.id]
                    ? 'input-error'
                    : ''} h-24 input-sm mt-1 input input-bordered w-full mb-3 text-base py-4"
                ></textarea>
              {:else}
                <input
                  id={field.id}
                  name={field.id}
                  type={field.input_type}
                  autocomplete={field.autocomplete}
                  class="{errors[field.id]
                    ? 'input-error'
                    : ''} input-sm mt-1 input input-bordered w-full mb-3 text-base py-4"
                />
              {/if}
            </label>
          {/each}

          {#if Object.keys(errors).length > 0}
            <p class="text-error text-sm mb-2">
              {error_message}
            </p>
          {/if}

          <div class="turnstile-container">
            <Turnstile siteKey={TURNSTILE_SITEKEY} theme="light" bind:reset />
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full py-2 font-bold disabled:opacity-50 mt-4"
            disabled={is_waiting}
          >
            {#if is_waiting}
              <svg class="animate-spin mx-auto h-5 w-5" viewBox="0 0 50 50">
                <circle class="path" cx="25" cy="25" r="20" fill="none" stroke="#000000" stroke-width="4"
                ></circle>
              </svg>
            {:else}
              Submit
            {/if}
          </button>
        </form>
      </div>
    {/if}
  </div>
</div>
