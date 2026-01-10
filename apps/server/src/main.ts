import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, raw, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Security headers
  app.use(
    helmet({
      // Keep CSP off initially to avoid breaking the app; we can turn on later with a tuned policy
      contentSecurityPolicy: false,
    }),
  );

  // Stripe webhook requires raw body for signature verification
  const stripeWebhookPaths = [
    '/payments/webhook',
    '/payments/webhooks/stripe',
    '/api/payments/webhook',
    '/api/payments/webhooks/stripe',
  ];
  for (const p of stripeWebhookPaths) {
    app.use(p, raw({ type: 'application/json', limit: '1mb' }));
  }

  // Request size limits to prevent abuse (skip webhook path)
  const jsonParser = json({ limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (stripeWebhookPaths.some((p) => req.originalUrl?.startsWith(p))) {
      return next();
    }
    return jsonParser(req, res, next);
  });
  // Special parser for CSP reports (browsers send application/csp-report)
  app.use(
    '/csp-report',
    json({
      type: ['application/json', 'application/csp-report'],
      limit: '50kb',
    }),
  );
  const urlEncodedParser = urlencoded({ extended: true, limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (stripeWebhookPaths.some((p) => req.originalUrl?.startsWith(p))) {
      return next();
    }
    return urlEncodedParser(req, res, next);
  });

  // Enable CORS (accept comma-separated origins; include common localhost defaults in dev)
  const isProd = process.env.NODE_ENV === 'production';
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ];
  const corsEnv = process.env.CORS_ORIGIN;
  const origin = isProd
    ? (corsEnv ?? defaultOrigins[0])
    : (corsEnv
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? defaultOrigins);
  app.enableCors({ origin, credentials: true });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra properties are sent
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert strings to numbers when needed
      },
    }),
  );

  const port = process.env.PORT || 3001;

  // Content Security Policy (report-only)
  app.use(
    helmet.contentSecurityPolicy?.({
      useDefaults: true,
      reportOnly: true,
      directives: {
        // Adjust these as the frontend stack evolves
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", '*'],
        'frame-ancestors': ["'self'"],
        // Where browsers send report payloads
        'report-uri': ['/csp-report'],
      },
    }) as Parameters<typeof app.use>[0],
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Cumprido API')
    .setDescription('REST API for the Cumprido platform')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Attach metrics middleware to measure HTTP requests
  try {
    const { MetricsService } = await import('./observability/metrics.service');
    const metrics = app.get(MetricsService);
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const end = process.hrtime.bigint();
        const diffNs = Number(end - start);
        const seconds = diffNs / 1e9;
        const route = req.path ?? 'unknown';
        metrics.observeRequest(req.method, route, res.statusCode, seconds);
      });
      next();
    });
  } catch {
    // metrics optional
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📘 Swagger docs at http://localhost:${port}/docs`);
}
void bootstrap();
