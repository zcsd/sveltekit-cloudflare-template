<script>
  import "$appcss";
  import { onMount } from 'svelte';
  import { WEBSITE_NAME } from "$config";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";
  import { setContext } from "svelte";
  import { sessions_and_activities } from "$store";

  export let data;
  const { user } = data;

  const section_store = writable("");
  setContext("dashboard_section", section_store);
  let dashboard_section;
  section_store.subscribe((value) => {
    dashboard_section = value;
  });

  let isOpen = false;
  let dropdownRef;

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function handleClickOutside(event) {
    if (dropdownRef && !dropdownRef.contains(event.target)) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function close_drawer() {
    const dashboard_drawer = document.getElementById("dashboard-drawer");
    dashboard_drawer.checked = false;
  }

  async function sign_out() {
    const response = await fetch("/dashboard/api/sign-out", { method: "POST" });
    if (response.ok) {
      sessions_and_activities.set({
        login_sessions: [],
        activities: [],
        fetched_at: null
      }); // clear the store data
      goto("/");
    }
  }

  function get_initial_name(name) {
    return name ? name[0].toUpperCase() : "?";
  }

  function get_display_name() {
    return user.nickname.length > 20
      ? user.nickname.substring(0, 20) + "..."
      : user.nickname;
  }
</script>

<div class="drawer lg:drawer-open">
  <input id="dashboard-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <div class="navbar bg-base-100 lg:hidden">
      <div class="flex-1">
        <a class="btn btn-ghost normal-case text-xl" href="/dashboard"
          >{WEBSITE_NAME}</a
        >
      </div>
      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <label for="dashboard-drawer" class="btn btn-ghost btn-circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </label>
        </div>
      </div>
    </div>
    <div class="container px-6 lg:px-12 py-3 lg:py-6">
      <slot {data} />
    </div>
  </div>

  <div class="drawer-side">
    <label for="dashboard-drawer" class="drawer-overlay" />
    <ul
      class="menu menu-lg p-4 w-72 min-h-full bg-base-100 lg:border-r text-primary"
    >
      <li>
        <div
          class="normal-case menu-title text-xl font-bold text-primary flex flex-row"
        >
          <a href="/dashboard" class="grow">{WEBSITE_NAME}</a>
          <label for="dashboard-drawer" class="lg:hidden ml-2"> &#x2715; </label>
        </div>
      </li>
      <li>
        <a
          href="/dashboard"
          class={dashboard_section === "home" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Home
        </a>
      </li>
      <li>
        <a
          href="/dashboard/billing"
          class={dashboard_section === "billing" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            stroke="none"
            fill="currentColor"
          >
            <path
              d="M18,1H6A3,3,0,0,0,3,4V22a1,1,0,0,0,1.8.6L6.829,19.9l1.276,2.552a1,1,0,0,0,.8.549.981.981,0,0,0,.89-.4L12,19.667,14.2,22.6a.983.983,0,0,0,.89.4,1,1,0,0,0,.8-.549L17.171,19.9,19.2,22.6a1,1,0,0,0,.8.4,1,1,0,0,0,1-1V4A3,3,0,0,0,18,1Zm1,18-1.2-1.6a.983.983,0,0,0-.89-.4,1,1,0,0,0-.8.549l-1.276,2.552L12.8,17.4a1,1,0,0,0-1.6,0L9.171,20.105,7.9,17.553A1,1,0,0,0,7.09,17a.987.987,0,0,0-.89.4L5,19V4A1,1,0,0,1,6,3H18a1,1,0,0,1,1,1ZM17,9a1,1,0,0,1-1,1H8A1,1,0,0,1,8,8h8A1,1,0,0,1,17,9Zm-4,4a1,1,0,0,1-1,1H8a1,1,0,0,1,0-2h4A1,1,0,0,1,13,13Z"
            />
          </svg>
          Billing
        </a>
      </li>
      <li>
        <a
          href="/dashboard/sessions"
          class={dashboard_section === "sessions" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" stroke="none" fill="none">
            <path
              d="M3 10.4167C3 7.21907 3 5.62028 3.37752 5.08241C3.75503 4.54454 5.25832 4.02996 8.26491 3.00079L8.83772 2.80472C10.405 2.26824 11.1886 2 12 2C12.8114 2 13.595 2.26824 15.1623 2.80472L15.7351 3.00079C18.7417 4.02996 20.245 4.54454 20.6225 5.08241C21 5.62028 21 7.21907 21 10.4167C21 10.8996 21 11.4234 21 11.9914C21 17.6294 16.761 20.3655 14.1014 21.5273C13.38 21.8424 13.0193 22 12 22C10.9807 22 10.62 21.8424 9.89856 21.5273C7.23896 20.3655 3 17.6294 3 11.9914C3 11.4234 3 10.8996 3 10.4167Z"
              stroke="currentColor"
              stroke-width="2"
            />
            <circle
              cx="12"
              cy="9"
              r="2"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M16 15C16 16.1046 16 17 12 17C8 17 8 16.1046 8 15C8 13.8954 9.79086 13 12 13C14.2091 13 16 13.8954 16 15Z"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
          Sessions
        </a>
      </li>
      <li>
        <a
          href="/dashboard/settings"
          class={dashboard_section === "settings" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" stroke="none" fill="none">
            <path
              d="M20.3499 8.92293L19.9837 8.7192C19.9269 8.68756 19.8989 8.67169 19.8714 8.65524C19.5983 8.49165 19.3682 8.26564 19.2002 7.99523C19.1833 7.96802 19.1674 7.93949 19.1348 7.8831C19.1023 7.82677 19.0858 7.79823 19.0706 7.76998C18.92 7.48866 18.8385 7.17515 18.8336 6.85606C18.8331 6.82398 18.8332 6.79121 18.8343 6.72604L18.8415 6.30078C18.8529 5.62025 18.8587 5.27894 18.763 4.97262C18.6781 4.70053 18.536 4.44993 18.3462 4.23725C18.1317 3.99685 17.8347 3.82534 17.2402 3.48276L16.7464 3.1982C16.1536 2.85658 15.8571 2.68571 15.5423 2.62057C15.2639 2.56294 14.9765 2.56561 14.6991 2.62789C14.3859 2.69819 14.0931 2.87351 13.5079 3.22396L13.5045 3.22555L13.1507 3.43741C13.0948 3.47091 13.0665 3.48779 13.0384 3.50338C12.7601 3.6581 12.4495 3.74365 12.1312 3.75387C12.0992 3.7549 12.0665 3.7549 12.0013 3.7549C11.9365 3.7549 11.9024 3.7549 11.8704 3.75387C11.5515 3.74361 11.2402 3.65759 10.9615 3.50224C10.9334 3.48658 10.9056 3.46956 10.8496 3.4359L10.4935 3.22213C9.90422 2.86836 9.60915 2.69121 9.29427 2.62057C9.0157 2.55807 8.72737 2.55634 8.44791 2.61471C8.13236 2.68062 7.83577 2.85276 7.24258 3.19703L7.23994 3.1982L6.75228 3.48124L6.74688 3.48454C6.15904 3.82572 5.86441 3.99672 5.6517 4.23614C5.46294 4.4486 5.32185 4.69881 5.2374 4.97018C5.14194 5.27691 5.14703 5.61896 5.15853 6.3027L5.16568 6.72736C5.16676 6.79166 5.16864 6.82362 5.16817 6.85525C5.16343 7.17499 5.08086 7.48914 4.92974 7.77096C4.9148 7.79883 4.8987 7.8267 4.86654 7.88237C4.83436 7.93809 4.81877 7.96579 4.80209 7.99268C4.63336 8.26452 4.40214 8.49186 4.12733 8.65572C4.10015 8.67193 4.0715 8.68752 4.01521 8.71871L3.65365 8.91908C3.05208 9.25245 2.75137 9.41928 2.53256 9.65669C2.33898 9.86672 2.19275 10.1158 2.10349 10.3872C2.00259 10.6939 2.00267 11.0378 2.00424 11.7255L2.00551 12.2877C2.00706 12.9708 2.00919 13.3122 2.11032 13.6168C2.19979 13.8863 2.34495 14.134 2.53744 14.3427C2.75502 14.5787 3.05274 14.7445 3.64974 15.0766L4.00808 15.276C4.06907 15.3099 4.09976 15.3266 4.12917 15.3444C4.40148 15.5083 4.63089 15.735 4.79818 16.0053C4.81625 16.0345 4.8336 16.0648 4.8683 16.1255C4.90256 16.1853 4.92009 16.2152 4.93594 16.2452C5.08261 16.5229 5.16114 16.8315 5.16649 17.1455C5.16707 17.1794 5.16658 17.2137 5.16541 17.2827L5.15853 17.6902C5.14695 18.3763 5.1419 18.7197 5.23792 19.0273C5.32287 19.2994 5.46484 19.55 5.65463 19.7627C5.86915 20.0031 6.16655 20.1745 6.76107 20.5171L7.25478 20.8015C7.84763 21.1432 8.14395 21.3138 8.45869 21.379C8.73714 21.4366 9.02464 21.4344 9.30209 21.3721C9.61567 21.3017 9.90948 21.1258 10.4964 20.7743L10.8502 20.5625C10.9062 20.5289 10.9346 20.5121 10.9626 20.4965C11.2409 20.3418 11.5512 20.2558 11.8695 20.2456C11.9015 20.2446 11.9342 20.2446 11.9994 20.2446C12.0648 20.2446 12.0974 20.2446 12.1295 20.2456C12.4484 20.2559 12.7607 20.3422 13.0394 20.4975C13.0639 20.5112 13.0885 20.526 13.1316 20.5519L13.5078 20.7777C14.0971 21.1315 14.3916 21.3081 14.7065 21.3788C14.985 21.4413 15.2736 21.4438 15.5531 21.3855C15.8685 21.3196 16.1657 21.1471 16.7586 20.803L17.2536 20.5157C17.8418 20.1743 18.1367 20.0031 18.3495 19.7636C18.5383 19.5512 18.6796 19.3011 18.764 19.0297C18.8588 18.7252 18.8531 18.3858 18.8417 17.7119L18.8343 17.2724C18.8332 17.2081 18.8331 17.1761 18.8336 17.1445C18.8383 16.8247 18.9195 16.5104 19.0706 16.2286C19.0856 16.2007 19.1018 16.1726 19.1338 16.1171C19.166 16.0615 19.1827 16.0337 19.1994 16.0068C19.3681 15.7349 19.5995 15.5074 19.8744 15.3435C19.9012 15.3275 19.9289 15.3122 19.9838 15.2818L19.9857 15.2809L20.3472 15.0805C20.9488 14.7472 21.2501 14.5801 21.4689 14.3427C21.6625 14.1327 21.8085 13.8839 21.8978 13.6126C21.9981 13.3077 21.9973 12.9658 21.9958 12.2861L21.9945 11.7119C21.9929 11.0287 21.9921 10.6874 21.891 10.3828C21.8015 10.1133 21.6555 9.86561 21.463 9.65685C21.2457 9.42111 20.9475 9.25526 20.3517 8.92378L20.3499 8.92293Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8.00033 12C8.00033 14.2091 9.79119 16 12.0003 16C14.2095 16 16.0003 14.2091 16.0003 12C16.0003 9.79082 14.2095 7.99996 12.0003 7.99996C9.79119 7.99996 8.00033 9.79082 8.00033 12Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Settings
        </a>
      </li>
      <li class="lg:hidden">
        <a
          href="/dashboard"
          class={dashboard_section === "doc" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" stroke="none" fill="none">
            <path
              d="M3 10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H13C16.7712 2 18.6569 2 19.8284 3.17157C21 4.34315 21 6.22876 21 10V14C21 17.7712 21 19.6569 19.8284 20.8284C18.6569 22 16.7712 22 13 22H11C7.22876 22 5.34315 22 4.17157 20.8284C3 19.6569 3 17.7712 3 14V10Z"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M8 12H16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M8 8H16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M8 16H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          Doc
        </a>
      </li>
      <li class="lg:hidden">
        <a
          href="/dashboard"
          class={dashboard_section === "help" ? "active" : ""}
          on:click={close_drawer}
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" stroke="none" fill="none">
            <path
              d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M10.125 8.875C10.125 7.83947 10.9645 7 12 7C13.0355 7 13.875 7.83947 13.875 8.875C13.875 9.56245 13.505 10.1635 12.9534 10.4899C12.478 10.7711 12 11.1977 12 11.75V13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          Help
        </a>
      </li>
      <li class="lg:hidden mt-auto">
        <button on:click={sign_out}>
          <svg class="h-5 w-5" viewBox="0 0 24 24" stroke="none" fill="none">
            <path
              d="M9.00195 7C9.01406 4.82497 9.11051 3.64706 9.87889 2.87868C10.7576 2 12.1718 2 15.0002 2L16.0002 2C18.8286 2 20.2429 2 21.1215 2.87868C22.0002 3.75736 22.0002 5.17157 22.0002 8L22.0002 16C22.0002 18.8284 22.0002 20.2426 21.1215 21.1213C20.2429 22 18.8286 22 16.0002 22H15.0002C12.1718 22 10.7576 22 9.87889 21.1213C9.11051 20.3529 9.01406 19.175 9.00195 17"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M15 12L2 12M2 12L5.5 9M2 12L5.5 15"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Sign out
        </button>
      </li>

      <div class="dropdown dropdown-top mt-auto ml-2 lg:flex hidden" role="button" tabindex="0">
        <button
          class="relative h-10 w-10 rounded-full text-base bg-base-200 hover:bg-primary hover:text-base-100 font-bold flex items-center justify-center transition"
        >
          {get_initial_name(user.nickname)}
        </button>
        <ul
          class="dropdown-content bg-base-100 z-[100] menu p-2 border shadow rounded-box w-52"
        > 
          <!--  haven't implemented the toggle theme functionality yet
          <li>
            <a href="/dashboard" target="_blank" class="text-base">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                stroke="none"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="5"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M12 2V4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M12 20V22"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M4 12L2 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M22 12L20 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M19.7778 4.22266L17.5558 6.25424"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M4.22217 4.22266L6.44418 6.25424"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M6.44434 17.5557L4.22211 19.7779"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M19.7778 19.7773L17.5558 17.5551"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Toggle theme
            </a>
          </li>
          -->
          <li>
            <!-- TODO: /doc -->
            <a href="/dashboard" class="text-base">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                stroke="none"
                fill="none"
              >
                <path
                  d="M3 10C3 6.22876 3 4.34315 4.17157 3.17157C5.34315 2 7.22876 2 11 2H13C16.7712 2 18.6569 2 19.8284 3.17157C21 4.34315 21 6.22876 21 10V14C21 17.7712 21 19.6569 19.8284 20.8284C18.6569 22 16.7712 22 13 22H11C7.22876 22 5.34315 22 4.17157 20.8284C3 19.6569 3 17.7712 3 14V10Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M8 12H16"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M8 8H16"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M8 16H13"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Doc
            </a>
          </li>
          <li>
            <!-- TODO: /help -->
            <a href="/dashboard" class="text-base">
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                stroke="none"
                fill="none"
              >
                <path
                  d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M10.125 8.875C10.125 7.83947 10.9645 7 12 7C13.0355 7 13.875 7.83947 13.875 8.875C13.875 9.56245 13.505 10.1635 12.9534 10.4899C12.478 10.7711 12 11.1977 12 11.75V13"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <circle cx="12" cy="16" r="1" fill="currentColor" />
              </svg>
              Help
            </a>
          </li>
          <li>
            <button class="text-base" on:click={sign_out}>
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                stroke="none"
                fill="none"
              >
                <path
                  d="M9.00195 7C9.01406 4.82497 9.11051 3.64706 9.87889 2.87868C10.7576 2 12.1718 2 15.0002 2L16.0002 2C18.8286 2 20.2429 2 21.1215 2.87868C22.0002 3.75736 22.0002 5.17157 22.0002 8L22.0002 16C22.0002 18.8284 22.0002 20.2426 21.1215 21.1213C20.2429 22 18.8286 22 16.0002 22H15.0002C12.1718 22 10.7576 22 9.87889 21.1213C9.11051 20.3529 9.01406 19.175 9.00195 17"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M15 12L2 12M2 12L5.5 9M2 12L5.5 15"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Sign out
            </button>
          </li>
        </ul>
      <p class="flex justify-center items-center ml-1 text-base">
        {get_display_name(user.nickname)}
      </p>
      </div>
    </ul>
  </div>
</div>
