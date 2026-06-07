import { LoggerService } from '@nestjs/common';

export class JsonLoggerService implements LoggerService {
  private write(level: string, message: unknown, context?: string): void {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        context: context ?? '',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      }),
    );
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
