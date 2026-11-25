/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1717F4',
          'primary-dark': '#0e0ee0',
          'primary-light': '#eff1fe',
          accent: '#FFD21A',
          'accent-warm': '#F5C400',
          background: '#F6F8FC',
          text: '#111B3D',
        },
      },
    },
  },
  plugins: [],
};
