import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/prototype-emergent-rpg-03/' : '/',
  plugins: [svelte()],
}));
