/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'lc3': {
          'bg': '#0d1117',
          'surface': '#161b22',
          'surface-2': '#1c2128',
          'border': '#30363d',
          'text': '#e6edf3',
          'text-muted': '#8b949e',
          'accent': '#58a6ff',
          'accent-hover': '#79c0ff',
          'green': '#3fb950',
          'red': '#f85149',
          'yellow': '#d29922',
          'orange': '#db6d28',
          'purple': '#bc8cff',
        },
      },
      fontFamily: {
        'mono': ['"JetBrains Mono"', '"Fira Code"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
      animation: {
        'flash-green': 'flashGreen 0.6s ease-out',
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(63, 185, 80, 0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}
