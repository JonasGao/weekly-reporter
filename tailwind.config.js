/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0EA5E9',
        secondary: '#F97316',
        accent: '#881337',
        background: '#F0F9FF',
        surface: '#FFFFFF',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'serif'],
        body: ['"Outfit"', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1.5rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
