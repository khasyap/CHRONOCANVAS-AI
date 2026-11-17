/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        elevated: 'var(--elevated)',
        stroke: 'var(--stroke)',
        'stroke-strong': 'var(--stroke-strong)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        lavender: 'var(--lavender)',
        violet: 'var(--violet)',
        night: '#08120D',
        navy: '#0E1A13',
        champagne: '#D9B678',
        ivory: '#F2EEE3',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        tech: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        glass: '0 30px 80px -30px var(--shadow-color)',
        lift: '0 18px 50px -22px var(--shadow-color)',
        glow: '0 0 60px -12px rgba(94,140,99,0.5)',
        champagne: '0 0 50px -18px rgba(217,182,120,0.42)',
      },
      letterSpacing: {
        widest2: '0.28em',
        widest3: '0.36em',
      },
      keyframes: {
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(4%, -3%, 0) scale(1.06)' },
          '66%': { transform: 'translate3d(-3%, 2%, 0) scale(0.96)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.45' },
          '50%': { opacity: '0.9' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee-x': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        drift: 'drift 26s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 3.5s ease-in-out infinite',
        'spin-slow': 'spin-slow 28s linear infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'marquee-x': 'marquee-x 38s linear infinite',
      },
    },
  },
  plugins: [],
};
