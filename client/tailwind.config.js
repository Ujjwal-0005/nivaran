/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sovereign-indigo': '#0B2545',
        'kesariya': '#E65100',
        'civic-flame': '#FF7A00',
        'jan-kalyan-green': '#00875A',
        'sandstone': '#FDFBF7',
        'parchment': '#F5EFE6',
        'earthen-slate': '#D8CEBE',
        'earthen-slate-dark': '#B5A895',
        'terracotta-alert': '#B84A39',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
      },
    },
  },
  plugins: [],
}
