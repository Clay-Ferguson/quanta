/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./server/index.html",
    "./client/**/*.{js,ts,jsx,tsx}",
    "./plugins/**/client/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}