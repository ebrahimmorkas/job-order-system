const pino = require('pino');
const fs = require('fs');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

// Production: JSON lines written to backend/logs/app.log.
// Development: coloured, readable output in the terminal.
const createDestination = () => {
  if (!isProd) {
    return pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    });
  }

  const logsDir = path.join(__dirname, '../logs');
  fs.mkdirSync(logsDir, { recursive: true });
  return pino.destination({ dest: path.join(logsDir, 'app.log'), sync: false });
};

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: null, // leaves pid and hostname out of every line
  },
  createDestination()
);

module.exports = logger;
