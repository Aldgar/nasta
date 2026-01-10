import { Test } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService computeFinalAmount', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: { get: jest.fn(() => undefined) } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  it('returns dto.finalAmount when provided', () => {
    const result = (service as any).computeFinalAmount(
      { approvedUnits: null, agreedRateAmount: null, agreedPayUnit: null },
      { rateAmount: null, paymentType: 'HOURLY' },
      { approvedUnits: undefined, finalAmount: 1234 },
    );
    expect(result).toBe(1234);
  });

  it('computes units x rate when terms present', () => {
    const result = (service as any).computeFinalAmount(
      { approvedUnits: 2, agreedRateAmount: 500, agreedPayUnit: 'HOURLY' },
      { rateAmount: 1000, paymentType: 'DAILY' },
      { approvedUnits: undefined, finalAmount: undefined },
    );
    expect(result).toBe(1000);
  });

  it('uses dto.approvedUnits override', () => {
    const result = (service as any).computeFinalAmount(
      { approvedUnits: 1, agreedRateAmount: 700, agreedPayUnit: 'HOURLY' },
      { rateAmount: 1000, paymentType: 'DAILY' },
      { approvedUnits: 3, finalAmount: undefined },
    );
    expect(result).toBe(2100);
  });

  it('throws if missing rate/unit', () => {
    expect(() =>
      (service as any).computeFinalAmount(
        { approvedUnits: 1, agreedRateAmount: null, agreedPayUnit: null },
        { rateAmount: null, paymentType: 'HOURLY' },
        { approvedUnits: undefined, finalAmount: undefined },
      ),
    ).toThrow();
  });

  it('throws if units are zero', () => {
    expect(() =>
      (service as any).computeFinalAmount(
        { approvedUnits: 0, agreedRateAmount: 500, agreedPayUnit: 'HOURLY' },
        { rateAmount: 1000, paymentType: 'DAILY' },
        { approvedUnits: undefined, finalAmount: undefined },
      ),
    ).toThrow('Approved units required');
  });
});
