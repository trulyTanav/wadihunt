import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const removeCrossOriginPlugin = () => {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s*crossorigin(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g, '');
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeCrossOriginPlugin()],
  base: './',
})
