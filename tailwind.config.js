/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        up: '#16a34a',
        down: '#dc2626',
      },
    },
  },
  plugins: [],
}
