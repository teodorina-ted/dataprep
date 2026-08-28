/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        onit: {
          blue: '#0078D4',
          dark: '#0F172A',
          surface: '#F8FAFC',
          border: '#E2E8F0',
          muted: '#64748B',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626'
        }
      }
    }
  },
  plugins: []
}
