import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Keep local development at http://127.0.0.1:5187/ while building
  // production assets for the GitHub Pages project-site subpath.
  base: command === 'build' ? '/cute-island-rpg/' : '/',
}));
