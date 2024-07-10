<script>
  import { WEBSITE_NAME } from "$config";
  import { get } from 'svelte/store';
  import { getContext } from "svelte";
  import { onMount } from 'svelte';
  import { sessions_and_activities } from "$store";

  let dashboard_section = getContext("dashboard_section");
  dashboard_section.set("sessions");

  async function fetch_data() {
    try {
      const response = await fetch('/dashboard/sessions');
      if (response.status === 200) {
        const data = await response.json();

        sessions_and_activities.set({
          ...data,
          fetched_at: Date.now()
        });
      }
    } catch (error) {
      console.log('Failed to fetch data. Try again later.');
    }
  }

  function initialize_data() {
    const data = get(sessions_and_activities);
    const current_time = Date.now();

    if (!data.fetched_at || (current_time - data.fetched_at) > 5 * 60 * 1000) {
      // Fetch data if it's not fetched yet or it's older than 5 minutes
      fetch_data();
    }
  }

  onMount(() => {
    initialize_data();
  });

  let login_sessions = [];
  let activities = [];

  // sessions_and_activities saved in store, not LocalStorage, we don't want to keep the data forever.
  // once the page is reload(F5), the store data will be reset, need to fetch the data again.
  sessions_and_activities.subscribe(value => {
    login_sessions = value.login_sessions;
    activities = value.activities;
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 1718241432621 => 2024-06-13 09:17:12 in local time
  function convert_epoch_to_localtime(epoch_time) {
    const date = new Date(epoch_time);
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone
    };

    const date_str = date.toLocaleString('en-GB', options);
    const [day, month, year, hour, minute, second] = date_str.match(/\d+/g);

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
</script>

<svelte:head>
  <title>Sessions - {WEBSITE_NAME}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-6">Sessions</h1>

<div class="card p-6 pb-4 mt-8 flex flex-col shadow">
  <div class="text-xl font-bold mb-2 w-48 flex-none">Active Sessions</div>
  <div class="text-base mb-4 font-normal">View and manage all of your active sessions.</div>
  <div class="border-b mb-4"></div>
  <div class="w-full min-w-48">
    <div class="overflow-x-auto">
      <table class="table text-base">
        <thead>
          <tr>
            <th>TIME</th>
            <th>DEVICE</th>
            <th>IP ADDRESS</th>
            <th>LOCATION</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#if login_sessions.length > 0}
            {#each login_sessions as session}
              <tr>
                <td class="flex items-center">
                  <div class="w-2.5 h-2.5 bg-success rounded-full mr-2"></div>
                  {convert_epoch_to_localtime(session.created_at)}
                </td>
                <td>{session.ua_device}</td>
                <td>{session.ip_address}</td>
                <td>{session.country}</td>
                <td>{session.is_current_session == true ? "Current session" : ""}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="4" class="text-center pb-6">Try again later</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="card p-6 pb-4 mt-8 flex flex-col shadow">
  <div class="text-xl font-bold mb-3 w-48 flex-none">Activity History</div>
  <div class="text-base mb-4 font-normal">View and manage your latest account activity.</div>
  <div class="border-b mb-4"></div>
  <div class="w-full min-w-48">
    <div class="overflow-x-auto">
      <table class="table text-base">
        <thead>
          <tr>
            <th>TIME</th>
            <th>DEVICE</th>
            <th>IP ADDRESS</th>
            <th>LOCATION</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {#if activities.length > 0}
            {#each activities as activity}
              <tr>
                <td class="flex items-center">
                  <div class="w-2.5 h-2.5 bg-gray-400 rounded-full mr-2"></div>
                  {convert_epoch_to_localtime(activity.created_at)}
                </td>
                <td>{activity.ua_device}</td>
                <td>{activity.ip_address}</td>
                <td>{activity.country}</td>
                <td>{activity.action_name}</td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5" class="text-center pb-6">Try again later</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>