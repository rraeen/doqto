import { API_PREFIX, CONTRACT_VERSION } from '@doqto/shared';
import { type INestApplication } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationPipe } from './common/http/validation';
import { AppConfig } from './config/app-config.service';

/**
 * Everything `main.ts` applies to the app, shared with e2e tests so they exercise the same
 * prefix, pipes, filters and middleware as production.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;

  app.useLogger(app.get(Logger));
  const trustProxy = config.get('TRUST_PROXY');
  if (trustProxy > 0) express.set('trust proxy', trustProxy);
  express.disable('x-powered-by');

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  app.use(helmet());
  app.use(cookieParser());
  const origins = config.get('CORS_ORIGINS');
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || origins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    maxAge: 600,
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Doqto API')
    .setDescription(
      `REST API ${API_PREFIX}. Shapes mirror packages/shared (contract ${CONTRACT_VERSION}). ` +
        'Errors use the envelope { error: { code, message, details?, requestId? } }.',
    )
    .setVersion(config.get('APP_VERSION'))
    .addBearerAuth()
    .addCookieAuth('doqto_at')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc), {
    jsonDocumentUrl: 'api/docs-json',
  });
  return app;
}
