#!/usr/bin/env node

import chalk from 'chalk';
import importLocal from 'import-local';
import isInstalledGlobally from 'is-installed-globally';
import { logger } from './logger.js';

// Prefer the local installation
if (!importLocal(import.meta.url)) {
  if (isInstalledGlobally) {
    logger.info(`Using global install of ${chalk.green('rc')}.`);
  }

  await import('./cli.js');
}
