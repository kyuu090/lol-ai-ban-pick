const path = require('node:path');
const log = require('electron-log/main');

const DEFAULT_LOG_LEVEL = 'info';
const LOG_FILE_NAME = 'debug.log';
const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const LOG_LEVELS = new Set(['error', 'warn', 'info', 'verbose', 'debug', 'silly']);
let hasInitializedDiagnostics = false;

function getLogLevel() {
  const level = String(process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL).toLowerCase();
  return LOG_LEVELS.has(level) ? level : DEFAULT_LOG_LEVEL;
}

function configureLogger() {
  const level = getLogLevel();
  const writeToCwd = process.env.LOG_TO_CWD === '1';

  log.transports.console.level = level;
  log.transports.file.level = level;
  log.transports.file.fileName = LOG_FILE_NAME;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
  log.transports.file.resolvePathFn = (variables) => (
    writeToCwd
      ? path.join(process.cwd(), LOG_FILE_NAME)
      : path.join(variables.userData, 'logs', LOG_FILE_NAME)
  );

  log.initialize({ preload: true });
  initializeDiagnostics();
  log.info('Logger configured', {
    level,
    file: log.transports.file.getFile().path,
    maxSizeBytes: LOG_MAX_SIZE_BYTES,
    writeToCwd
  });

  return log;
}

function initializeDiagnostics() {
  if (hasInitializedDiagnostics) return;
  hasInitializedDiagnostics = true;

  log.errorHandler.startCatching({
    showDialog: false
  });
  log.eventLogger.startLogging({
    level: 'warn'
  });
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
