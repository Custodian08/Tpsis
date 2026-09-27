import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use((request, response, next) => {
    const requestId = randomUUID();
    (request as typeof request & { requestId: string }).requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (process.env.NODE_ENV === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  
  // Глобальная валидация
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  
  // CORS для фронтенда
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });
  
  // Префикс для всех API маршрутов
  app.setGlobalPrefix('api');
  
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`Приложение запущено на порту ${port}`);
}
bootstrap().catch(error => {
  // Startup diagnostics intentionally omit error details that could contain environment values.
  new Logger('Bootstrap').error(`Запуск приложения не удался (${error instanceof Error ? error.name : 'UnknownError'}). Проверьте конфигурацию и доступность БД.`);
  process.exitCode = 1;
});
