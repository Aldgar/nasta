import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Authorization (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /background-checks/admin/reviews should be 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/background-checks/admin/reviews')
      .expect(401);
  });

  it('GET /admin/users/deletion-requests should be 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/admin/users/deletion-requests')
      .expect(401);
  });
});
