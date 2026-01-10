import { BadRequestException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

// Minimal PrismaService mock with only what ProfilesService uses
function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    admin: {
      findUnique: jest.fn(),
    },
    // ProfilesService uses typed delegates via casting; ensure these exist
    userProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    employerProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    adminProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  } as any;
}

describe('ProfilesService', () => {
  let service: ProfilesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma = createPrismaMock();
    service = new ProfilesService(prisma);
  });

  describe('updateUserProfile', () => {
    it('upserts profile and syncs user.avatar when avatarUrl provided', async () => {
      prisma.userProfile.upsert.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        avatarUrl: 'uploads/profiles/a.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateUserProfile('u1', {
        bio: 'Hi',
        avatarUrl: 'uploads/profiles/a.jpg',
      });

      expect(prisma.userProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        create: {
          userId: 'u1',
          bio: 'Hi',
          avatarUrl: 'uploads/profiles/a.jpg',
        },
        update: { bio: 'Hi', avatarUrl: 'uploads/profiles/a.jpg' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatar: 'uploads/profiles/a.jpg' },
      });
      expect(result.profile.avatarUrl).toBe('uploads/profiles/a.jpg');
    });
  });

  describe('updateUserAddress', () => {
    it('throws if only lat or only lng provided', async () => {
      await expect(
        service.updateUserAddress('u1', { lat: 10 as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.updateUserAddress('u1', { lng: 10 as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws for out-of-range coordinates', async () => {
      await expect(
        service.updateUserAddress('u1', { lat: -200 as any, lng: 0 as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.updateUserAddress('u1', { lat: 0 as any, lng: 200 as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upserts when lat/lng valid', async () => {
      prisma.userProfile.upsert.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        lat: 38.7,
        lng: -9.1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await service.updateUserAddress('u1', {
        addressLine1: '123 Main',
        city: 'Lisbon',
        country: 'PT',
        lat: 38.7 as any,
        lng: -9.1 as any,
      });
      expect(prisma.userProfile.upsert).toHaveBeenCalled();
      expect(res.message).toBe('Address updated');
    });
  });
});
