/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'IBM Plex Sans Arabic',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef7f4',
          100: '#d5ebe3',
          200: '#aed8c9',
          300: '#7cbfa9',
          400: '#4ba186',
          500: '#2f866b',
          600: '#236b56',
          700: '#1d5646',
          800: '#1a4539',
          900: '#173a31',
        },
      },
      boxShadow: {
        card: '0 14px 36px -24px rgb(15 23 42 / 0.18), 0 2px 6px rgb(15 23 42 / 0.04)',
      },
    },
  },
  plugins: [],
};
