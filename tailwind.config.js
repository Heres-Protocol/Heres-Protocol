/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        lucid: {
          bg: '#030712',
          surface: '#0a0f1a',
          card: '#111827',
          border: 'rgba(34, 211, 238, 0.2)',
          accent: '#22d3ee',
          accentDim: 'rgba(34, 211, 238, 0.15)',
          purple: '#a78bfa',
          purpleDim: 'rgba(167, 139, 250, 0.2)',
          cyan: '#22d3ee',
          muted: '#6b7280',
          white: '#f9fafb',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34, 211, 238, 0.15), transparent 50%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(167, 139, 250, 0.12), transparent 50%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 40px rgba(34, 211, 238, 0.25)',
        'glow-purple': '0 0 40px rgba(167, 139, 250, 0.25)',
        'card-hover': '0 24px 48px -12px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
