import { defineConfig } from '@tomjs/eslint';

export default defineConfig({
  type: 'app',
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
  },
});
