import { defineConfig } from 'tsup';

export default defineConfig(options => {
  const isDev = !!options.watch;
  return {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: ['es2022', 'node18'],
    shims: true,
    clean: true,
    sourcemap: isDev,
    splitting: false,
  };
});
