/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-base': '#272121',
        'brand-surface': '#443737',
        'brand-primary': '#FF0000',
        'brand-secondary': '#FF4D00',
        'brand-offwhite': '#F2EFE9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
