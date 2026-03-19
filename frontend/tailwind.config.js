/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      keyframes: {
        'glow-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(2, 132, 199, 0.7),  0 0 0 0 rgba(2, 132, 199, 0.4)' },
          '40%':  { boxShadow: '0 0 16px 6px rgba(2, 132, 199, 0.5), 0 0 32px 12px rgba(2, 132, 199, 0.2)' },
          '70%':  { boxShadow: '0 0 8px 3px rgba(2, 132, 199, 0.4), 0 0 20px 8px rgba(2, 132, 199, 0.15)' },
          '100%': { boxShadow: '0 0 16px 6px rgba(2, 132, 199, 0.5), 0 0 32px 12px rgba(2, 132, 199, 0.2)' },
        },
      },
      animation: {
        'glow-ring': 'glow-ring 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
