import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import * as Joi from 'joi';
import {
  ThrottlerModule,
  ThrottlerGuard,
  getOptionsToken,
  getStorageToken,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiService } from './ai/ai.service';
import { AiController } from './ai/ai.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BackgroundCheckModule } from './background-check/background-check.module';
import { UsersModule } from './users/users.module';
import { JobsModule } from './jobs/jobs.module';
import { KycModule } from './kyc/kyc.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ApplicationsModule } from './applications/applications.module';
import { DevModule } from './dev/dev.module';
import { MetricsModule } from './observability/metrics.module';
import { FeedModule } from './feed/feed.module';
import { PaymentsModule } from './payments/payments.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { ChatModule } from './chat/chat.module';
import { TrackingModule } from './tracking/tracking.module';
import { SupportModule } from './support/support.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RatingsModule } from './ratings/ratings.module';
import { NoShowModule } from './no-show/no-show.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReflectorModule } from './core/reflector.module';

@Module({
  imports: [
    ReflectorModule, // Provide Reflector globally first
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      // Look for env in repo root and app folder to support monorepo execution from root
      envFilePath: ['.env', 'apps/server/.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().integer().min(1).max(65535).default(3001),
        JWT_SECRET: Joi.string().min(32).required(),
        DATABASE_URL: Joi.string().uri().required(),
        ADMIN_INVITE_CODE: Joi.string().min(8).optional(),
        CORS_ORIGIN: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required(),
          otherwise: Joi.string().optional(),
        }),
        THROTTLE_TTL: Joi.number().integer().min(1).default(60),
        THROTTLE_LIMIT: Joi.number().integer().min(1).default(20),
        THROTTLE_AUTH_TTL: Joi.number().integer().min(1).default(60),
        THROTTLE_AUTH_LIMIT: Joi.number().integer().min(1).default(5),
        // Email (SMTP) - optional
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().integer().min(1).max(65535).optional(),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        SMTP_FROM: Joi.string().email().optional(),
        // Stripe - optional but required to use payments
        STRIPE_SECRET_KEY: Joi.string().optional(),
        STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().optional(),
        // Client base URL (Next.js app) used for OAuth redirects
        CLIENT_BASE_URL: Joi.string().uri().optional(),

        // Public base URL for this server (used to generate clickable HTTPS links in emails)
        // Example: https://api.nasta.app
        SERVER_PUBLIC_URL: Joi.string().uri().optional(),

        // Universal Links / App Links configuration (served from this server)
        // iOS: used in /.well-known/apple-app-site-association
        APPLE_TEAM_ID: Joi.string()
          .pattern(/^[A-Z0-9]{10}$/)
          .optional(),
        IOS_BUNDLE_ID: Joi.string().min(3).optional(),

        // Android: used in /.well-known/assetlinks.json
        ANDROID_PACKAGE_NAME: Joi.string().min(3).optional(),
        ANDROID_SHA256_CERT_FINGERPRINT: Joi.string()
          .pattern(/^[A-F0-9]{2}(?::[A-F0-9]{2}){31}$/)
          .optional(),
      }),
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: Number(process.env.THROTTLE_TTL) || 60,
            limit: Number(process.env.THROTTLE_LIMIT) || 20,
          },
          {
            name: 'auth',
            ttl: Number(process.env.THROTTLE_AUTH_TTL) || 60,
            limit: Number(process.env.THROTTLE_AUTH_LIMIT) || 5,
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    BackgroundCheckModule,
    UsersModule,
    JobsModule,

    KycModule,
    NotificationsModule,
    ProfilesModule,
    ApplicationsModule,
    MetricsModule,
    FeedModule,
    PaymentsModule,
    AvailabilityModule,
    BookingsModule,
    ChatModule,
    ...(process.env.NODE_ENV !== 'production' ? [DevModule] : []),
    TrackingModule,
    SupportModule,
    ReviewsModule,
    RatingsModule,
    NoShowModule,
    VehiclesModule,
  ],
  controllers: [AppController, AiController],
  providers: [
    AppService,
    AiService,
    {
      provide: APP_GUARD,
      useFactory: (
        options: ThrottlerModuleOptions,
        storage: ThrottlerStorage,
        reflector: Reflector,
      ) => new ThrottlerGuard(options, storage, reflector),
      inject: [getOptionsToken(), getStorageToken(), Reflector],
    },
  ],
})
export class AppModule {}
