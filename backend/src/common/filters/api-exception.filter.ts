import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = request.requestId || randomUUID();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const path = request.originalUrl?.split('?')[0] || request.url;
    const publicError = this.publicError(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Do not log exception messages or stacks here: database/client errors can contain SQL values.
      this.logger.error(`requestId=${requestId} ${request.method} ${path} status=${status} type=${exception instanceof Error ? exception.name : 'UnknownError'}`);
    } else {
      this.logger.warn(`requestId=${requestId} ${request.method} ${path} status=${status}`);
    }

    if (response.headersSent) return;
    response.status(status).json({
      statusCode: status,
      message: publicError.message,
      ...(publicError.errors ? { errors: publicError.errors } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    });
  }

  private publicError(exception: unknown, status: number): { message: string | string[]; errors?: string[] } {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { message: 'Внутренняя ошибка сервера. Повторите попытку позже.' };
    }
    if (!(exception instanceof HttpException)) return { message: 'Запрос не может быть обработан.' };

    const body = exception.getResponse();
    if (typeof body === 'string') return { message: body };
    if (body && typeof body === 'object') {
      const payload = body as { message?: unknown; errors?: unknown };
      const message = typeof payload.message === 'string' || Array.isArray(payload.message)
        ? payload.message as string | string[]
        : exception.message;
      const errors = Array.isArray(payload.errors)
        ? payload.errors.filter((item): item is string => typeof item === 'string')
        : undefined;
      return { message, ...(errors?.length ? { errors } : {}) };
    }
    return { message: exception.message };
  }
}
