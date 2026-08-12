/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        glass: {
          bg: 'rgba(30, 41, 59, 0.6)',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      }
    },
  },
  plugins: [],
}
