import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        warning: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        // --- Vesper Commerce palette -------------------------------------
        ink: {
          50:  '#f7f6f4',
          100: '#eeebe6',
          200: '#ddd7cf',
          300: '#c3bab0',
          400: '#9a9084',
          500: '#7a7064',
          600: '#5c534a',
          700: '#443d36',
          800: '#2c2721',
          900: '#1c1a17',
          950: '#100f0d',
        },
        sand: {
          50:  '#fdfcfa',
          100: '#f8f6f1',
          200: '#f0ece3',
          300: '#e4ddd0',
          400: '#d2c7b4',
        },
        clay: {
          400: '#c98a63',
          500: '#b7714a',
          600: '#9a5c39',
        },
        moss: {
          400: '#7d8f74',
          500: '#61735a',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
      },
      maxWidth: {
        prose: '68ch',
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
