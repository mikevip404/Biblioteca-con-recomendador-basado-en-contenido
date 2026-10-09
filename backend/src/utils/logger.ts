export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Contexto adicional que se incluye en cada entrada de log. */
export interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

/**
 * Logger estructurado mínimo: cada línea es un JSON con timestamp, nivel,
 * servicio, mensaje y el contexto (incluido el correlation-id).
 * Sin dependencias externas; en producción se puede cambiar por Winston/Pino
 * sin tocar el resto del código, porque el consumo es la interfaz `Logger`.
 */
export function createLogger(
  service: string,
  level: LogLevel = 'info'
): Logger {
  const write = (
    lvl: LogLevel,
    message: string,
    context?: LogContext
  ): void => {
    if (LEVELS[lvl] < LEVELS[level]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      service,
      message,
      ...context
    };
    const line = JSON.stringify(entry);
    if (lvl === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context)
  };
}
