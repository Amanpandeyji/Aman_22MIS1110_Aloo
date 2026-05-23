import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 20px 80px rgba(0, 0, 0, 0.28)'
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(circle at top, rgba(255,255,255,0.2), transparent 50%)'
      }
    }
  },
  plugins: []
};

export default config;