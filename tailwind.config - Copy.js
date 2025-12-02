/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        holo: {
          500: '#00f3ff',
          900: '#001a1d',
        }
      },
    },
  },
  plugins: [],
}