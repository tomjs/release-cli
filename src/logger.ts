import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import dayjs from 'dayjs';
import logSymbols from 'log-symbols';
import stripAnsi from 'strip-ansi';

const logDir = path.join(os.homedir(), '.tomjs', 'release-cli', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// clean log before 30 days ago
fs.readdirSync(logDir).forEach(s => {
  if (dayjs(s.substring(0, 8)).isBefore(dayjs().endOf('day').subtract(30, 'day'))) {
    fs.rmSync(path.join(logDir, s), { force: true });
  }
});

const logFile = path.join(logDir, `${dayjs().format('YYYYMMDD')}.log`);
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
}

export class Logger {
  private _debug = false;

  setDebug(debug: boolean) {
    this._debug = debug;
  }

  private _log(...args: any[]) {
    this._writeLog(...args);
    console.log(args.map(s => (typeof s === 'object' ? '%o' : '%s')).join(''), ...args);
  }

  format(...args: any[]) {
    return args.map(s => (typeof s === 'object' ? JSON.stringify(s) : s || '')).join(' ');
  }

  private _writeLog(...args: any[]) {
    fs.appendFileSync(
      logFile,
      `${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')} ${stripAnsi(this.format(...args))}\n`,
    );
  }

  log(...args: any[]) {
    this._log(...args);
  }

  write(...args: any[]) {
    this._writeLog(...args);
  }

  debug(...args: any[]) {
    if (this._debug) {
      this._log(
        ...args.map(s => {
          if (typeof s !== 'object') {
            return chalk.gray(s);
          }
          return s;
        }),
      );
    }
  }

  error(...args: any[]) {
    this._log(`${logSymbols.error} `, ...args);
  }

  info(...args: any[]) {
    this._log(`${logSymbols.info} `, ...args);
  }

  success(...args: any[]) {
    this._log(`${logSymbols.success} `, ...args);
  }

  warning(...args: any[]) {
    this._log(`${logSymbols.warning} `, ...args);
  }

  warn(...args: any[]) {
    this.warning(...args);
  }
}

export const logger = new Logger();
