import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { defineConfig } from 'vite'

const removeCrossOriginPlugin = () => {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/\s*crossorigin(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g, '');
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 60', 'android >= 7', 'edge >= 79', 'firefox >= 60', 'safari >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderModernChunks: true
    }),
    removeCrossOriginPlugin()
  ],
  base: './',
})
