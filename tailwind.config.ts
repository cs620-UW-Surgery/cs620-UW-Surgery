import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0b0c10',
        pine: '#0f3d3e',
        moss: '#1f6f63',
        sand: '#efe7dc',
        clay: '#c7b4a1',
        blush: '#f5d9cc'
      },
      fontFamily: {
        serif: ['var(--font-serum)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 12px 30px rgba(9, 30, 23, 0.12)'
      },
      backgroundImage: {
        'grain': 'radial-gradient(circle at 20% 20%, rgba(15, 61, 62, 0.12), transparent 35%), radial-gradient(circle at 80% 0%, rgba(199, 180, 161, 0.18), transparent 40%), radial-gradient(circle at 50% 80%, rgba(245, 217, 204, 0.18), transparent 50%)'
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
