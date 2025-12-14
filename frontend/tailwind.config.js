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
        // Clean, distinct sans for the UI elements
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        // Monospace for all currency/data tables to ensure perfect alignment
        mono: ['"JetBrains Mono"', 'Menlo', 'Consolas', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // "Canvas" - A warm, light palette for a premium financial app
        // Light theme with subtle warmth and texture
        canvas: {
          50: '#ffffff', // Pure white for cards
          100: '#f9f8f6', // App background (Light mode) - subtle off-white
          200: '#f2f0ed', // Borders
          300: '#e8e5e0', // Hover states
          400: '#d4cfc8', // Disabled / subtle dividers
          500: '#a39e97', // Muted text
          600: '#736f6a', // Secondary text
          700: '#4a4743', // Primary text
          800: '#2c2a27', // Headings
          900: '#1a1917', // Strong emphasis
          950: '#0a0908', // Reserved
        },
        // "Flux" - The primary action color.
        // Used for the "Punch through" buttons and active states.
        brand: {
          DEFAULT: '#0d9488', // Teal-600: Trustworthy, financial, calming
          hover: '#0f766e',   // Teal-700
          glow: 'rgba(13, 148, 136, 0.2)',
        },
        // Semantic financial colors
        finance: {
          income: '#059669',  // Emerald-600: Vibrant green for income
          expense: '#dc2626', // Red-600: Clear but not too aggressive
          net: '#7c3aed',     // Violet-600: For neutral/totals
        }
      },
      backgroundImage: {
        'paper-texture': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        // Subtle glow for the "Active Transaction" in the categorization loop
        'focus-ring': '0 0 0 2px rgba(13, 148, 136, 0.2)',
        // Deep shadow for floating modals (Search/Import)
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        // Glow for brand buttons
        'brand-glow': '0 0 20px rgba(13, 148, 136, 0.3)',
        // Soft card shadow for elevated containers
        'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.08)',
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