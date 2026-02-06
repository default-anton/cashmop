/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')

export default {
  darkMode: 'class', // Desktop apps usually toggle this manually or sync with system
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // A friendlier, more expressive UI stack for "super fan" vibes.
        sans: ['"Avenir Next"', 'Inter', ...defaultTheme.fontFamily.sans],
        // Monospace for all currency/data tables to ensure perfect alignment.
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // "Canvas" - Cooler, brighter base so accents can pop.
        canvas: {
          50: '#ffffff',
          100: '#f5f5ff',
          200: '#ececff',
          300: '#d8d7ff',
          400: '#b8b7e6',
          500: '#8d8bb8',
          600: '#615f87',
          700: '#413f63',
          800: '#2a2946',
          900: '#1c1b34',
          950: '#121124',
        },
        // "Brand" - punchy electric violet.
        brand: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          soft: '#ede9fe',
          ink: '#1f1142',
          glow: 'rgba(124, 58, 237, 0.35)',
        },
        // Semantic financial colors.
        finance: {
          income: '#059669',
          expense: '#ef4444',
          net: '#6366f1',
        }
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'focus-ring': '0 0 0 2px rgba(124, 58, 237, 0.22)',
        'glass': '0 18px 45px -22px rgba(34, 24, 80, 0.45)',
        'brand-glow': '0 10px 28px -12px rgba(124, 58, 237, 0.55)',
        'card': '0 12px 34px -24px rgba(24, 16, 56, 0.38)',
        'card-hover': '0 20px 44px -24px rgba(30, 22, 70, 0.48)',
      },
      animation: {
        // Fast, snappy transitions for the "TikTok style" swipe effect
        'snap-in': 'snapIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        snapIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}