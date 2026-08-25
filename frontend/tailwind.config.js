/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Outfit"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight: '-0.025em',
        snug: '-0.0125em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.12em',
        mega: '0.22em',
      },
      colors: {
        prussian: { blue: '#080e1e', DEFAULT: '#080e1e' },
        space: { indigo: '#121e3c', DEFAULT: '#121e3c' },
        dusk: { blue: '#273a66', DEFAULT: '#273a66' },
        tropical: { teal: '#5bc0be', DEFAULT: '#5bc0be' },
        slate: {
          950: '#080e1e',
          900: '#0d172e',
          850: '#121e3c',
          800: '#182649',
          750: '#20325d',
          700: '#2b3f70',
          600: '#4a6198',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        cyan: {
          950: '#082f49',
          900: '#0c4a6e',
          800: '#075985',
          700: '#0369a1',
          600: '#0284c7',
          500: '#06b6d4',
          400: '#22d3ee',
          300: '#67e8f9',
          200: '#a5f3fc',
          100: '#cffafe',
          50: '#ecfeff',
        },
        blue: {
          950: '#172554',
          900: '#1e3a8a',
          800: '#1e40af',
          700: '#1d4ed8',
          600: '#2563eb',
          500: '#3b82f6',
          400: '#60a5fa',
          300: '#93c5fd',
          200: '#bfdbfe',
          100: '#dbeafe',
          50: '#eff6ff',
        },
        glass: {
          bg: 'rgba(18, 30, 60, 0.65)',
          border: 'rgba(255, 255, 255, 0.08)',
          highlight: 'rgba(255, 255, 255, 0.04)',
        }
      }
    },
  },
  plugins: [],
}
