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
        prussian: { blue: '#0b132b' },
        space: { indigo: '#1c2541' },
        dusk: { blue: '#3a506b' },
        tropical: { teal: '#5bc0be' },
        slate: {
          900: '#0b132b',
          800: '#1c2541',
          700: '#1c2541',
          600: '#3a506b',
          500: '#3a506b',
          400: '#3a506b',
          300: '#ffffff',
          200: '#ffffff',
          100: '#ffffff',
          50: '#ffffff'
        },
        cyan: {
          950: '#5bc0be',
          900: '#5bc0be',
          800: '#5bc0be',
          700: '#5bc0be',
          600: '#5bc0be',
          500: '#5bc0be',
          400: '#5bc0be',
        },
        blue: {
          600: '#5bc0be',
          500: '#5bc0be',
          400: '#5bc0be',
        },
        glass: {
          bg: 'rgba(28, 37, 65, 0.6)',
          border: 'rgba(58, 80, 107, 0.3)',
        }
      }
    },
  },
  plugins: [],
}
