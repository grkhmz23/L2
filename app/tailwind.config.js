/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sable: {
          black: '#030303',
          graphite: '#11100e',
          raised: '#171512',
          border: 'rgba(248, 241, 210, 0.10)',
          ivory: '#f8f1d2',
          muted: '#9b978d',
          gold: '#d6be70',
          goldBright: '#fcf6ba',
          goldDeep: '#b38728',
          success: '#6ee7b7',
          warning: '#f4c95d',
          error: '#fb7185',
        },
        primary: {
          50: '#fffbe8',
          100: '#fcf6ba',
          200: '#eadb8c',
          300: '#d6be70',
          400: '#c8a757',
          500: '#bf953f',
          600: '#9f782f',
          700: '#7c5c27',
          800: '#5b431f',
          900: '#3b2d18',
        },
      },
    },
  },
  plugins: [],
};
