import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Histogram,
  Counter,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register = new Registry();
  private readonly httpDuration: Histogram<string>;
  private readonly httpRequests: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.register });
    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
      registers: [this.register],
    });
    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });
  }

  getRegistry() {
    return this.register;
  }

  observeRequest(
    method: string,
    route: string,
    statusCode: number,
    seconds: number,
  ) {
    const labels = {
      method: method.toUpperCase(),
      route,
      status_code: String(statusCode),
    } as const;
    this.httpDuration.observe(labels, seconds);
    this.httpRequests.inc(labels, 1);
  }
}
