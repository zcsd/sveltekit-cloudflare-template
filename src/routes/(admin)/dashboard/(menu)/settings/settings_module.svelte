<script>
  import { enhance, applyAction } from "$app/forms";
  import { page } from "$app/stores";
  import toast, { Toaster } from 'svelte-french-toast';

  const field_error = (live_form, name) => {
    let errors = live_form?.error_fields ?? [];
    return errors.includes(name);
  };

  let is_waiting = false;
  let show_success = false;

  // Module context
  export let editable = false;
  export let display_only = false;
  export let dangerous = false;
  export let title = "";
  export let message = "";
  export let fields = [];
  export let form_target = "";
  export let success_title = "Success";
  export let success_body = "";
  export let edit_button_title = "";
  export let edit_link = "";
  export let save_button_title = "Save";

  const handle_submit = () => {
    is_waiting = true;
    return async ({ update, result }) => {
      await update({ reset: false });
      await applyAction(result);
      is_waiting = false;
      if (result.type === "success") {
        show_success = true;
        if (result.data?.message) {
          toast.success(result.data.message, {duration: 5000});
        }
        
      }
    };
  };
</script>

<Toaster />

<div class="card p-6 pb-4 mt-8 max-w-xl flex flex-col md:flex-row shadow">
  {#if title}
    <div class="text-xl font-bold mb-3 w-48 flex-none">{title}</div>
  {/if}

  <div class="w-full min-w-48">
    {#if !show_success}
      {#if message}
        <div class="mb-6 {dangerous ? 'alert alert-warning' : ''}">
          {#if dangerous}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              /></svg
            >
          {/if}
          <span>{message}</span>
        </div>
      {/if}
      <form
        class="form-widget flex flex-col"
        method="POST"
        action={form_target}
        use:enhance={handle_submit}
      >
        {#each fields as field}
          {#if field.label}
            <label for={field.id}>
              <span class="text-sm text-gray-500">{field.label}</span>
            </label>
          {/if}
          {#if editable}
            <input
              id={field.id}
              name={field.id}
              type={field.input_type ?? "text"}
              disabled={!editable}
              placeholder={field.placeholder ?? field.label ?? ""}
              class="{field_error($page?.form, field.id)
                ? 'input-error'
                : ''} input-sm mt-1 input input-bordered w-full max-w-xs mb-3 text-base py-4"
              value={$page.form ? $page.form[field.id] : field.initial_value}
              maxlength={field.max_length ? field.max_length : null}
            />
          {:else}
            <div class="text-lg mb-3">{field.initial_value}</div>
          {/if}
        {/each}

        {#if $page?.form?.error_message}
          <p class="text-red-700 text-sm font-bold mt-1">
            {$page?.form?.error_message}
          </p>
        {/if}

        {#if editable}
          {#if !display_only}
            <div>
              <button
                type="submit"
                class="ml-auto btn btn-sm mt-3 min-w-[145px] {dangerous
                  ? 'btn-error'
                  : 'btn-success'}"
                disabled={is_waiting}
              >
                {#if is_waiting}
                  <span
                    class="is_waiting is_waiting-spinner is_waiting-md align-middle mx-3"
                  ></span>
                {:else}
                  {save_button_title}
                {/if}
              </button>
            </div>
          {/if}
        {:else}
          <!-- !editable -->
          {#if !display_only}
            <a href={edit_link} class="mt-1">
              <button
                class="btn btn-outline btn-sm {dangerous
                  ? 'btn-error'
                  : ''} min-w-[145px]"
              >
                {edit_button_title}
              </button>
            </a>
          {/if}
        {/if}
      </form>
    {:else}
      <!-- show_success -->
      <div>
        <div class="text-l font-bold">{success_title}</div>
        <div class="text-base">{success_body}</div>
      </div>
      <a href="/dashboard/settings">
        <button class="btn btn-outline btn-sm mt-3 min-w-[145px]">
          Return to Settings
        </button>
      </a>
    {/if}
  </div>
</div>
