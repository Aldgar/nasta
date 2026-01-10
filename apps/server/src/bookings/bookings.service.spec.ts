import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';

describe('BookingsService', () => {
  const prismaTyped: any = {};
  prismaTyped.user = { findUnique: jest.fn() };
  prismaTyped.booking = { create: jest.fn(), findFirst: jest.fn() };
  const availabilityTyped: any = { hasAvailabilityCoverage: jest.fn() };

  let service: BookingsService;

  beforeEach(() => {
    jest.resetAllMocks();
    return Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prismaTyped },
        { provide: AvailabilityService, useValue: availabilityTyped },
      ],
    })
      .compile()
      .then((moduleRef) => {
        service = moduleRef.get(BookingsService);
      });
  });

  it('throws if seeker not found', async () => {
    prismaTyped.user.findUnique.mockResolvedValue(null);
    await expect(
      service.createDirectBooking('emp1', {
        jobSeekerId: 'seeker1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        payUnit: 'HOURLY',
        rateAmount: 1000,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws if seeker not payments-enabled', async () => {
    prismaTyped.user.findUnique.mockResolvedValue({ id: 'seeker1' });
    availabilityTyped.hasAvailabilityCoverage.mockResolvedValue(true);
    await expect(
      service.createDirectBooking('emp1', {
        jobSeekerId: 'seeker1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        payUnit: 'HOURLY',
        rateAmount: 1000,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when not covered by availability', async () => {
    prismaTyped.user.findUnique.mockResolvedValue({
      id: 'seeker1',
      connectedAccountId: 'acct_123',
    });
    availabilityTyped.hasAvailabilityCoverage.mockResolvedValue(false);
    await expect(
      service.createDirectBooking('emp1', {
        jobSeekerId: 'seeker1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        payUnit: 'HOURLY',
        rateAmount: 1000,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when conflicts with existing booking', async () => {
    prismaTyped.user.findUnique.mockResolvedValue({
      id: 'seeker1',
      connectedAccountId: 'acct_123',
    });
    availabilityTyped.hasAvailabilityCoverage.mockResolvedValue(true);
    prismaTyped.booking.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.createDirectBooking('emp1', {
        jobSeekerId: 'seeker1',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        payUnit: 'HOURLY',
        rateAmount: 1000,
        currency: 'EUR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates booking on happy path', async () => {
    prismaTyped.user.findUnique.mockResolvedValue({
      id: 'seeker1',
      connectedAccountId: 'acct_123',
    });
    availabilityTyped.hasAvailabilityCoverage.mockResolvedValue(true);
    prismaTyped.booking.findFirst.mockResolvedValue(null);
    prismaTyped.booking.create.mockResolvedValue({ id: 'book1' });
    const res = await service.createDirectBooking('emp1', {
      jobSeekerId: 'seeker1',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      payUnit: 'HOURLY',
      rateAmount: 1000,
      currency: 'EUR',
    });
    expect(res).toEqual({ id: 'book1' });
  });
});
