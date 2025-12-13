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
        // "Obsidian" - A rich, deep zinc palette for the application shell
        // Replaces standard grays to feel more "premium software"
        obsidian: {
          50: '#f9fafb',
          100: '#f4f4f5', // App background (Light mode)
          200: '#e4e4e7', // Borders
          300: '#d4d4d8',
          400: '#a1a1aa', // Muted text
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46', // Card borders (Dark mode)
          800: '#27272a', // Card background (Dark mode)
          900: '#18181b', // Sidebar/Panel background (Dark mode)
          950: '#09090b', // App background (Dark mode)
        },
        // "Flux" - The primary action color.
        // Used for the "Punch through" buttons and active states.
        brand: {
          DEFAULT: '#6366f1', // Indigo-500: Vivid but not blinding
          hover: '#4f46e5',   // Indigo-600
          glow: 'rgba(99, 102, 241, 0.5)',
        },
        // Semantic financial colors
        finance: {
          income: '#10b981',  // Emerald-500: Crisp, modern green
          expense: '#f43f5e', // Rose-500: Less aggressive than standard red
          net: '#8b5cf6',     // Violet: For neutral/totals
        }
      },
      boxShadow: {
        // Subtle glow for the "Active Transaction" in the categorization loop
        'focus-ring': '0 0 0 2px rgba(99, 102, 241, 0.2)',
        // Deep shadow for floating modals (Search/Import)
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
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
