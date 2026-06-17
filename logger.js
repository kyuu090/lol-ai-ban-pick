const path = require('node:path');
const log = require('electron-log/main');

const DEFAULT_LOG_LEVEL = 'info';
const LOG_FILE_NAME = 'debug.log';
const LOG_LEVELS = new Set(['error', 'warn', 'info', 'verbose', 'debug', 'silly']);

function getLogLevel() {
  const level = String(process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL).toLowerCase();
  return LOG_LEVELS.has(level) ? level : DEFAULT_LOG_LEVEL;
}

function configureLogger() {
  const level = getLogLevel();
  const writeToCwd = process.env.LOG_TO_CWD === '1';

  log.transports.console.level = level;
  log.transports.file.level = level === 'debug' || writeToCwd ? level : false;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  if (writeToCwd) {
    log.transports.file.resolvePathFn = () => path.join(process.cwd(), LOG_FILE_NAME);
  }

  log.initialize({ preload: true });
  log.info('Logger configured', {
    level,
    file: log.transports.file.level ? log.transports.file.getFile().path : null
  });

  return log;
}

function serializeForLog(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: value.code
    };
  }

  return value;
}

function logRendererMessage(_event, level, message, details) {
  const normalizedLevel = LOG_LEVELS.has(level) ? level : 'info';
  const logger = typeof log[normalizedLevel] === 'function' ? log[normalizedLevel] : log.info;
  logger.call(log, `[renderer] ${message}`, serializeForLog(details));
}

module.exports = {
  log,
  configureLogger,
  logRendererMessage,
  serializeForLog
};
