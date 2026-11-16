const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        primary: v('primary'),
        'primary-fg': v('primary-fg'),
        sage: v('sage'),
        beige: v('beige'),
        success: '#4F8A70',
        warn: '#E9A23B',
        danger: '#D64545',
      },
      boxShadow: { card: '0 1px 2px rgb(61 52 45 / 0.06), 0 4px 16px rgb(61 52 45 / 0.04)' },
    },
  },
  plugins: [],
}
