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
        // "Canvas" - cool neutral slate to reduce eye fatigue on dense finance views.
        canvas: {
          50: '#ffffff',
          100: '#f8fafc',
          200: '#f1f5f9',
          300: '#e2e8f0',
          400: '#cbd5e1',
          500: '#94a3b8',
          600: '#64748b',
          700: '#475569',
          800: '#334155',
          900: '#1e293b',
          950: '#0f172a',
        },
        // "Brand" - Ledger Mint accent.
        brand: {
          DEFAULT: '#0f766e',
          hover: '#115e59',
          alt: '#0e7490',
          soft: '#ccfbf1',
          ink: '#092724',
          glow: 'rgba(15, 118, 110, 0.35)',
        },
        // Semantic financial colors.
        finance: {
          income: '#15803d',
          expense: '#b91c1c',
          net: '#1d4ed8',
        },
        status: {
          warning: {
            DEFAULT: '#b45309',
            soft: '#fffbeb',
            border: '#fcd34d',
            ink: '#78350f',
          },
          info: {
            DEFAULT: '#0369a1',
            soft: '#e0f2fe',
            border: '#7dd3fc',
            ink: '#0c4a6e',
          },
        },
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'focus-ring': '0 0 0 2px rgba(15, 118, 110, 0.22)',
        'glass': '0 18px 45px -22px rgba(15, 23, 42, 0.32)',
        'brand-glow': '0 10px 28px -12px rgba(15, 118, 110, 0.52)',
        'card': '0 12px 34px -24px rgba(15, 23, 42, 0.24)',
        'card-hover': '0 20px 44px -24px rgba(15, 23, 42, 0.34)',
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