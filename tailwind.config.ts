import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        uwred: '#c5050c',
        uwdarkred: '#9b0000',
        darkgray: '#282728',
        muted: '#646569',
        accent: '#dadfe1',
        lightgray: '#f7f7f7'
      },
      fontFamily: {
        serif: ['var(--font-serum)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 12px 30px rgba(40, 39, 40, 0.08)'
      },
      keyframes: {
        rise: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      },
      animation: {
        rise: 'rise 0.6s ease-out both'
      }
    }
  },
  plugins: []
};

export default config;
