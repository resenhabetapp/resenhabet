/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          container: {
            low: 'rgb(var(--color-surface-container-low) / <alpha-value>)',
            DEFAULT: 'rgb(var(--color-surface-container-default) / <alpha-value>)',
            highest: 'rgb(var(--color-surface-container-highest) / <alpha-value>)',
          }
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
        },
        on: {
          surface: 'rgb(var(--color-on-surface) / <alpha-value>)',
          primary: 'rgb(var(--color-on-primary) / <alpha-value>)',
        },
        outline: {
          variant: 'var(--color-outline-variant)',
          'variant-raw': 'rgb(var(--color-outline-variant-raw) / <alpha-value>)',
        },
        accent: {
          blue: '#002776', // Azul Bandeira
          yellow: '#ffdf00', // Amarelo Bandeira
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'], // Títulos e placares
        body: ['Inter', 'sans-serif'], // Formulários e navegação
      },
      boxShadow: {
        'neon': 'var(--color-shadow-neon)',
        'floating': 'var(--color-shadow-floating)',
      }
    },
  },
  plugins: [],
}
