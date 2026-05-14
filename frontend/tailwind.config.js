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
        surface: {
          0: '#000000',
          1: '#0A0A0B',
          2: '#141416',
          3: '#1C1C20',
          4: '#26262C',
        },
        ink: {
          0: '#FAFAFA',
          1: '#E5E5E7',
          2: '#A1A1A6',
          3: '#6B6B70',
          4: '#3F3F44',
        },
        line: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
        },
        accent: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          soft: 'rgba(59,130,246,0.12)',
          ring: 'rgba(59,130,246,0.45)',
        },
        danger: {
          DEFAULT: '#EF4444',
          soft: 'rgba(239,68,68,0.12)',
        },
        success: {
          DEFAULT: '#22C55E',
          soft: 'rgba(34,197,94,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 28px rgba(0,0,0,0.45)',
        soft: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 8px rgba(0,0,0,0.35)',
        glow: '0 0 0 6px rgba(59,130,246,0.12)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp .35s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
