import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const page = (path) => resolve(import.meta.dirname, path)

export default defineConfig({
  // Multi-page app: each route is its own HTML file (/, /info/, …) instead of one page
  // that swaps content with JavaScript. 'mpa' also makes unknown URLs return a real 404
  // instead of silently showing the menu.
  appType: 'mpa',
  build: {
    rolldownOptions: {
      // The dev server finds HTML files on its own; the production build needs them listed.
      input: {
        menu: page('index.html'),
        info: page('info/index.html'),
        feedback: page('feedback/index.html'),
        login: page('login/index.html'),
        cart: page('cart/index.html'),
        kitchen: page('kitchen/index.html'),
      },
    },
  },
})
