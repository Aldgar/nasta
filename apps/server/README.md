<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Cumprido Server

The backend API for Cumprido task management platform, built with [NestJS](https://github.com/nestjs/nest) and Prisma ORM.

## Description

This server provides RESTful APIs for task management, user authentication, project organization, and real-time collaboration features.

## AI Provider Configuration (App-level)

Configure a unified AI provider for all clients (web + mobile) using environment variables. The server exposes a health endpoint to confirm configuration.

Environment variables:

```
AI_PROVIDER=anthropic        # one of: anthropic | openai | azure-openai
AI_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=...       # required if AI_PROVIDER=anthropic
# OPENAI_API_KEY=...        # required if AI_PROVIDER=openai
# AZURE_OPENAI_API_KEY=...  # required if AI_PROVIDER=azure-openai
# AZURE_OPENAI_ENDPOINT=... # required if AI_PROVIDER=azure-openai
```

Health check:

```
GET /ai/health

Response:
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "configured": true
}
```

Use this adapter as a foundation to wire AI usage into your application modules (e.g., summaries, recommendations). Add rate limiting and auditing as needed.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## API notes (Cumprido-specific)

- Users can update their address and location for proximity features:
  - PATCH /users/me/address
    - Body: { location, city, country, lat, lng }
- Jobs are public to browse; add optional proximity filters:
  - GET /jobs?lat=38.7223&lng=-9.1393&radiusKm=10&limit=50
- Employers and admins can post jobs (no KYC/background required). Employers must have a verified phone number; admins can post without it for testing:
  - POST /jobs (JWT required, role EMPLOYER with phone verified OR ADMIN)
    - Body: { title, description, categoryId, location, city, country, lat, lng, type?, workMode?, isInstantBook? }
    - If phone is not verified, server returns 422 with a structured error:
      { code: "ERR_PHONE_VERIFICATION_REQUIRED", message, action: { method: "POST", endpoint: "/auth/phone/request-verify" } }
- Applying to jobs remains gated by verification for job seekers.

## Profiles and verification (planning)

This section outlines the intended profile data models and verification requirements we will implement in the backend database and expose via profile APIs. It’s documentation only; no code changes are required right now.

### User profile (Job Seeker)

Core identity
- id (string, ObjectId), publicId (short public-facing id)
- firstName, lastName
- email (unique), phone (E.164), avatarUrl (optional)
- dateOfBirth (optional), nationality (optional)

Contact & address
- addressLine1, addressLine2?, city, state?, postalCode?, country
- coordinates: lat, lng (optional, used for proximity)

Verification & compliance
- emailVerified: boolean
- phoneVerified: boolean
- kyc: latest verification id/status/decision (links to KYC records)
- backgroundCheck: isBackgroundVerified, backgroundCheckStatus, backgroundCheckResult, backgroundCheckExpiry
- consent flags (privacy, marketing, terms version)

Work settings (optional, later)
- categories/interests, availability, languages, skills

Timestamps
- createdAt, updatedAt, lastLoginAt

Planned APIs
- GET /users/me/profile — returns full profile
- PATCH /users/me/profile — update basic fields (name, avatar)
- PATCH /users/me/address — update address/geo (already referenced above)
- GET /background-checks/my-status — current background check snapshot (exists)
- GET /kyc/my-status — current KYC snapshot (exists as /kyc/my-status)

### Employer profile

Core identity
- id (ObjectId), role = EMPLOYER
- companyName, contactName
- email (unique), phone (E.164)

Business/address
- addressLine1, addressLine2?, city, state?, postalCode?, country
- website? (optional)

Verification (current scope)
- emailVerified: boolean
- phoneVerified: boolean
- addressVerified: boolean (true once a valid address is on file; no KYC/background required)

Notes
- As discussed, employers only need email, phone verification, and address on file. No ID or background checks for employers are required at this stage. We can extend later with company registry checks (e.g., VAT/tax id, business registration documents) if needed for compliance or fraud prevention.

Planned APIs
- GET /employers/me/profile — returns employer profile
- PATCH /employers/me/profile — update company/contact details
- PATCH /employers/me/address — update address

### Admin profile

Core identity
- id (ObjectId), email (unique), firstName, lastName, isActive
- adminCapabilities: string[] — e.g., SUPER_ADMIN, BACKGROUND_CHECK_REVIEWER, DELETION_REQUEST_REVIEWER, SUPPORT

Security & ops
- lastLoginAt, mfaEnabled? (future)

Notes
- Admin routes are annotated with @Public to bypass the global user guard but still require AdminJwtGuard and AdminCapabilityGuard. Admin tokens must declare role=ADMIN; SUPER_ADMIN implicitly satisfies any capability.

Existing API
- GET /auth/admin/profile — returns current admin profile

### Verification matrix (current)

- Job Seeker: email + phone verification, KYC (ID), background check (required for certain categories like children/elderly work; general jobs allowed once approved), address recommended for proximity.
- Employer: email + phone verification, address on file; no KYC/background check required currently.
- Admin: internal; no end-user verifications required (optional MFA in the future).

### Role differentiation: requirements and abilities

- Job Seekers (role=JOB_SEEKER)
  - Requirements (progressive): emailVerified, phoneVerified, KYC verified (for higher-trust roles), background check (for children/elderly categories). Address optional but recommended for proximity. Skills managed via `UserSkill` and summarized in `UserProfile.skillsSummary`.
  - Abilities: apply to jobs, book instant jobs (once minimum verification met), chat, receive reviews, proximity matching.

- Employers (role=EMPLOYER)
  - Requirements: emailVerified, phoneVerified, and an address in `EmployerProfile` (addressLine1/city/country at minimum). No KYC/background.
  - Abilities: post jobs, manage applicants/bookings, chat, receive reviews. Company details can also be stored in `Company` if needed for team-level postings.

- Admins
  - Requirements: active admin with Admin JWT. Capabilities via `adminCapabilities` (e.g., SUPER_ADMIN or BACKGROUND_CHECK_REVIEWER).
  - Abilities: manage users/employers, review KYC/background, manage categories, moderate content.

### Data examples (indicative)

User profile (response fragment)
```json
{
  "id": "64fd...",
  "publicId": "USR-42FA",
  "firstName": "Ana",
  "lastName": "Silva",
  "email": "ana@example.com",
  "phone": "+351910000000",
  "emailVerified": true,
  "phoneVerified": true,
  "address": {
    "addressLine1": "Rua Augusta 1",
    "city": "Lisboa",
    "country": "PT"
  },
  "backgroundCheck": {
    "isBackgroundVerified": true,
    "status": "APPROVED",
    "result": "CLEAN",
    "expiry": "2026-02-12T00:00:00.000Z"
  },
  "kyc": {
    "status": "VERIFIED"
  }
}
```

Employer profile (response fragment)
```json
{
  "id": "64fe...",
  "companyName": "Acme Lda.",
  "contactName": "João Pereira",
  "email": "jobs@acme.pt",
  "phone": "+351930000000",
  "emailVerified": true,
  "phoneVerified": true,
  "address": {
    "addressLine1": "Av. da Liberdade 100",
    "city": "Lisboa",
    "country": "PT"
  }
}
```

## Google OAuth setup (development)

To enable "Continue with Google" locally:

1) Create OAuth credentials in Google Cloud Console
- App type: Web application
- Authorized redirect URI: `http://localhost:3001/auth/google/callback`

2) Configure server environment
- Copy `apps/server/.env.example` to `apps/server/.env`
- Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and verify `GOOGLE_CALLBACK_URL`
- Ensure `CLIENT_BASE_URL` points to your Next app (default `http://localhost:3002`)

3) Configure client environment
- Copy `apps/client/.env.example` to `apps/client/.env.local`
- Adjust `NEXT_PUBLIC_API_BASE_URL` if your API runs on a different port

4) Run apps
- Start the server (port 3001) and the client (port 3002)
- In the client Login page, pick your role tab, then click "Continue with Google"

Behavior
- If a user with that email+role exists, you'll be redirected back with a JWT and signed in.
- If not registered, you'll be redirected to the appropriate onboarding (`/onboarding/job-seeker` or `/onboarding/employer`) with email/name prefilled via query params.
