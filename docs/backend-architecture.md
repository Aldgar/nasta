# Backend Architecture Overview

A concise reference for designing, building, and scaling the platform backend. No implementation here—just structure and decisions to guide development and reviews.

## High-level

- Stack: NestJS (TypeScript), Prisma, MongoDB
- Auth: JWT access (short-lived), optional refresh; role/capability guards
- Delivery: REST (v1), OpenAPI docs, Postman collection in-repo
- Messaging: In-app notifications; optional email/SMS; in-process events now, external queues later
- Geo: Haversine proximity; 2dsphere index later
- Deploy: Containerized service, health/readiness probes, structured logs

## Domain modules (NestJS)

- AuthModule
  - Register, login, refresh, password reset
  - Email/phone verification (OTP), admin invite
  - Guards: JwtAuthGuard, AdminJwtGuard, capability guard
- UsersModule
  - Profiles, settings, address/GPS
- JobsModule
  - Create/list/search with proximity filters
  - Employer posting rules (phone-verified), admin bypass for testing
  - Apply to jobs, status transitions (in coordination with Applications)
- ApplicationsModule
  - Create/list (seeker/employer views), status changes, audit trail hooks
- NotificationsModule
  - Persisted notifications (list, mark read/all)
  - Triggers: job created (nearby seekers), application created/status changes, etc.
- Kyc/BackgroundCheckModule
  - KYC initiation/status, background check flows, admin review
  - Driver License flow: initiate with verificationType=DRIVERS_LICENSE, upload documentFront/documentBack, admin verifies; Jobs guard enforces for driving-required categories
- ChatModule (later)
  - Conversations, participants, messages, support/AI triage
- AdminModule
  - Users, jobs, applications, reports, flags, configurations
- MediaModule (later)
  - Uploads to S3-compatible storage, signed URLs, scanning hooks
- FeedModule (later)
  - Mixed job/user posts, reactions, comments, ranking
- PaymentsModule (later)
  - Subscriptions (employer plans), one-off charges (job boosts/featured), invoices
  - Payouts (to seekers or external parties, if required), refunds/disputes handling
  - Provider integration (Stripe-first) via a provider-agnostic interface
- HealthModule
  - /healthz and /readyz endpoints

## Data model (Mongo/Prisma)

- User
  - id, email, phone, role (JOB_SEEKER|EMPLOYER|ADMIN), isActive
  - verifications: email/phone/KYC/background
  - location: location/city/country, coordinates [lat,lng]
- Job
  - id, employerId, title, description, requirements[], responsibilities[]
  - type, workMode, location/city/country, coordinates, status, categoryId, isInstantBook
- Application
  - id, jobId, seekerId, status (APPLIED|REVIEW|INTERVIEW|OFFER|REJECTED), notes, timestamps
- Notification
  - id, userId, type (NEARBY_JOB|JOB_MESSAGE|APPLICATION_UPDATE|SYSTEM), title, body, payload (JSON), readAt, createdAt
- Conversation / Participant / Message (chat)
  - Conversation: id, type (PEER|SUPPORT|GROUP)
  - Participant: conversationId, userId, role
  - Message: id, conversationId, senderId, content, attachments, createdAt, readAt per user (later)
- KYC / BackgroundCheck
  - id, userId, provider, status, payload, files
- Feed (later)
  - Post: id, authorId, type (USER|JOB), jobId?, content, media[], visibility, createdAt
  - Reaction: id, postId, userId, type (unique on postId+userId)
  - Comment: id, postId, userId, content, parentId?, createdAt
- Payments (later)
  - Plan: id, code, name, price, currency, interval (month/year), features[], active
  - Subscription: id, userId or employerId, planId, status (ACTIVE|PAST_DUE|CANCELLED), currentPeriodStart/End, cancelAtPeriodEnd
  - Payment: id, subjectType (JOB_BOOST|SUBSCRIPTION|OTHER), subjectId, amount, currency, provider, providerPaymentId, status (SUCCEEDED|REQUIRES_ACTION|FAILED), receiptUrl
  - Invoice: id, subscriptionId?, amountDue, amountPaid, currency, status (OPEN|PAID|VOID|UNCOLLECTIBLE), providerInvoiceId
  - LedgerEntry: id, userId/employerId, type (DEBIT|CREDIT), amount, currency, balanceAfter, refType/refId, meta
  - Payout: id, toUserId, amount, currency, providerPayoutId, status (PENDING|PAID|FAILED)
  - WebhookEvent: id, provider, eventType, payload, processedAt, dedupKey

## API surface (v1)

- Auth
  - POST /auth/register, /auth/login, /auth/refresh
  - POST /auth/password/reset/request, /auth/password/reset/confirm
  - POST /auth/email/verify, /auth/phone/verify
  - GET /auth/admin/whoami — identity claims only (not profile data)
    - Deprecated alias: GET /auth/admin/profile (use whoami or /admin/profile CRUD)
- Users
  - GET /users/me, PATCH /users/me, PATCH /users/me/address
 - Admin Profiles
  - GET /admin/profile, PATCH /admin/profile — profile CRUD (canonical)
  - POST /admin/profile/avatar — multipart upload (avatar/logo)
- Jobs
  - GET /jobs?lat&lng&radiusKm&limit&type&workMode
  - POST /jobs (EMPLOYER/ADMIN; employer must be phone-verified)
  - POST /jobs/:id/apply (guarded; admin bypass for testing)
  - Some categories may require a verified Driver License (front+back uploaded via KYC and status VERIFIED)
- Applications
  - GET /applications/me (seeker)
  - GET /employer/applications (employer/admin)
  - POST /applications/:id/status (employer/admin)
- Employer listings
  - GET /employer/jobs
  - GET /employer/jobs/:id/applications
- Notifications
  - GET /notifications?status=all|unread&page&limit
  - POST /notifications/:id/read
  - POST /notifications/read-all
- Chat (later)
  - Conversations: GET/POST; Messages: GET/POST
- Feed (later)
  - GET /feed; POST /posts; reactions/comments
- Payments (later)
  - GET /payments/plans (public)
  - POST /payments/checkout/session (create checkout for job boost or subscription)
  - GET /payments/subscriptions (list my subscriptions)
  - POST /payments/subscriptions/:id/cancel
  - POST /payments/webhooks/stripe (webhook endpoint; signature-verified)
  - GET /payments/invoices (list my invoices)
  - GET /payments/payouts (list my payouts) — only if payouts are in scope
- Health
  - GET /healthz, GET /readyz

## Indexing & performance

- Mongo indexes (plan to add via Prisma schema):
  - Jobs: { status, createdAt }, 2dsphere on coordinates, { employerId, status }
  - Applications: { jobId, status }, { seekerId, createdAt }
  - Notifications: { userId, readAt, createdAt }
  - Users: unique(email), unique(phone?), { role, isActive }
  - Tokens/OTPs: TTL index for expiry
  - Payments: { providerPaymentId }, { subscriptionId }, { userId/employerId, createdAt }, WebhookEvent { provider, dedupKey }
- Pagination: prefer cursor-based for big lists (jobs, notifications, messages)
- Projection discipline: select only needed fields
- Background tasks: non-critical fan-out (emails/notifications)

## Security & compliance

- JWT access (short-lived) + optional refresh; revoke on password change
- Role + capability guards across modules; route-level authorization checks
- Rate-limiting for auth/OTP flows; IP/device hints
- DTO validation, content sanitization for user-generated content
- Secret management via env schema; plan vault/param store later
- Audit trail for admin-sensitive actions (log now; persist later)
- Payments-specific
  - Webhook signature validation (e.g., Stripe-Signature header)
  - Idempotency keys on client-initiated payment requests
  - Minimal PCI exposure (tokenize with provider; never store raw card data)
  - Tax/VAT support via provider metadata; invoicing requirements per region
  - Refund/dispute flows with provider events propagated to Notifications

## Events & notifications

- In-process event emitter now
- Emit on:
  - Job created → notify nearby seekers (persisted + optional email)
  - Application created/status changed → notify employer/seeker
  - Chat message received → notify participants (later)
  - Post reaction/comment/mention (later)
  - Payment events (later): checkout.completed, payment.succeeded/failed, invoice.paid/overdue, subscription.updated, payout.paid/failed
- Upgrade path: outbox + Redis/SQS/Kafka for reliability and scale

## Observability & ops

- Health/readiness endpoints
- Structured JSON logs with request IDs; slow query logging via Prisma
- Error tracking (Sentry/etc.) and application metrics (Prometheus/Otel) later

## Testing & quality gates

- Unit tests: AuthService, JobsService, NotificationsService, guards/utils
- E2E: register → login → protected → role gates → employer phone gating → admin bypass
- Test DB isolation/cleanup; seed helpers; coverage threshold
- CI: install → prisma generate → lint → build → tests → artifact

## Roadmap

1) Tests: auth unit + E2E
2) Employer listings (jobs + applications)
3) Application notifications (create/status)
4) Add critical Mongo indexes (no behavioral changes, big perf win)
5) OpenAPI docs + Postman updates
6) Health/readiness, logging polish
7) Chat scaffolding (conversations/messages)
8) Payments groundwork (plans, checkout flow, webhooks) — design first
9) Feed design implementation (posts/reactions/comments) later

---

This document is the living reference for backend scope and priorities. Update as features land or requirements evolve.
