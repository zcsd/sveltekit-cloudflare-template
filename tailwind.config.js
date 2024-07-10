/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          "color-scheme": "light",
          "primary": "#1c1917",
          "primary-content": "#fdfefe",
          "secondary": "#bfd9a9",
          "neutral": "#1c1917",
          "neutral-content": "#fdfefe",
          "accent": "#d26a00",
          "accent-content": "#1c1917",
          "base-content": "#1c1917",
          "base-100": "#fdfefe",
          "base-200": "#e2e9e9",
          "info": "#0000ff",
          "warning": "#eab308",
          "success": "#16b77b",
          "error": "#b91c1c",
        },
      },
    ],
  },
};
