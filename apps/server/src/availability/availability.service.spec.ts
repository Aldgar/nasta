import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const prismaMock: any = {
    availability: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: AvailabilityService;

  beforeEach(() => {
    jest.resetAllMocks();
    // Cast to unknown to satisfy strict typing for tests

    service = new AvailabilityService(prismaMock as unknown as any);
  });

  it('hasAvailabilityCoverage returns true when a slot fully covers range', async () => {
    prismaMock.availability.findFirst.mockResolvedValue({ id: 'slot1' });
    const start = new Date('2025-01-01T10:00:00Z');
    const end = new Date('2025-01-01T12:00:00Z');
    const res = await service.hasAvailabilityCoverage('user1', start, end);
    expect(res).toBe(true);
  });

  it('hasAvailabilityCoverage returns false when no covering slot', async () => {
    prismaMock.availability.findFirst.mockResolvedValue(null);
    const start = new Date('2025-01-01T10:00:00Z');
    const end = new Date('2025-01-01T12:00:00Z');
    const res = await service.hasAvailabilityCoverage('user1', start, end);
    expect(res).toBe(false);
  });

  it('checkConflict detects overlap', async () => {
    prismaMock.availability.findFirst.mockResolvedValue({ id: 'slotOverlap' });
    const start = new Date('2025-01-01T10:00:00Z');
    const end = new Date('2025-01-01T12:00:00Z');
    const { hasConflict } = await service.checkConflict('user1', start, end);
    expect(hasConflict).toBe(true);
  });
});
