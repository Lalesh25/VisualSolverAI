/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        display: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          night: '#070b14',
          deep: '#0c1222',
          surface: '#121a2e',
          teal: '#14b8a6',
          cyan: '#22d3ee',
          amber: '#fbbf24',
          rose: '#fb7185',
        },
      },
      boxShadow: {
        '3d-sm': '0 4px 0 0 rgba(15, 23, 42, 0.35), 0 8px 24px -4px rgba(20, 184, 166, 0.35)',
        '3d': '0 6px 0 0 rgba(15, 23, 42, 0.4), 0 16px 40px -8px rgba(34, 211, 238, 0.25)',
        '3d-lg': '0 10px 0 0 rgba(15, 23, 42, 0.45), 0 24px 56px -12px rgba(251, 191, 36, 0.2)',
        glow: '0 0 40px rgba(34, 211, 238, 0.35)',
        'glow-amber': '0 0 48px rgba(251, 191, 36, 0.25)',
      },
      keyframes: {
        'float-y': {
          '0%, 100%': { transform: 'translateY(0) rotateX(0deg)' },
          '50%': { transform: 'translateY(-14px) rotateX(3deg)' },
        },
        'float-orbit': {
          '0%': { transform: 'rotate(0deg) translateX(48px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(48px) rotate(-360deg)' },
        },
        'mesh-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'tilt-enter': {
          '0%': {
            opacity: '0',
            transform: 'perspective(1000px) rotateX(12deg) translateY(24px)',
          },
          '100%': {
            opacity: '1',
            transform: 'perspective(1000px) rotateX(0deg) translateY(0)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 211, 238, 0.45)' },
          '50%': { boxShadow: '0 0 0 12px rgba(34, 211, 238, 0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'float-y': 'float-y 7s ease-in-out infinite',
        'float-y-delay': 'float-y 9s ease-in-out infinite 1.5s',
        'float-orbit': 'float-orbit 22s linear infinite',
        'mesh-shift': 'mesh-shift 14s ease infinite',
        'tilt-enter':
          'tilt-enter 0.85s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.5s ease-out infinite',
        'fade-in': 'fade-in 0.25s ease-out forwards',
        'modal-in': 'modal-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
}
