import { Test } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminCapabilityGuard } from '../auth/guards/admin-capability.guard';
import { BadRequestException } from '@nestjs/common';

describe('KycController', () => {
  let controller: KycController;
  let service: {
    initiate: jest.Mock;
    uploadDocuments: jest.Mock;
    myStatus: jest.Mock;
    adminList: jest.Mock;
    adminReview: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      initiate: jest.fn(),
      uploadDocuments: jest.fn(),
      myStatus: jest.fn(),
      adminList: jest.fn(),
      adminReview: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        {
          provide: KycService,
          useValue: service,
        },
      ],
    })
      // Guards are not relevant in unit tests; override to no-ops
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminCapabilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(KycController);
  });

  describe('initiate', () => {
    it('throws if verificationType is missing', async () => {
      await expect(
        controller.initiate({ user: { id: 'u1' } } as any, undefined as any, {
          accepted: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws if consent is not accepted', async () => {
      await expect(
        controller.initiate(
          { user: { id: 'u1' } } as any,
          'GOVERNMENT_ID' as any,
          { accepted: false },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('calls service.initiate for valid input', async () => {
      service.initiate.mockResolvedValue({ id: 'v1' });
      const res = await controller.initiate(
        { user: { id: 'u1' } } as any,
        'GOVERNMENT_ID' as any,
        { accepted: true, version: '1' },
      );
      expect(service.initiate).toHaveBeenCalledWith('u1', 'GOVERNMENT_ID', {
        accepted: true,
        version: '1',
      });
      expect(res).toEqual({ id: 'v1' });
    });
  });

  describe('upload', () => {
    it('maps uploaded files and calls service', async () => {
      const files = {
        documentFront: [{ originalname: 'a.jpg' }],
        documentBack: undefined,
        selfie: [{ originalname: 'c.jpg' }],
      } as any;
      service.uploadDocuments.mockResolvedValue({ ok: true });
      const res = await controller.upload(
        'verif1',
        { user: { id: 'u1' } } as any,
        files,
      );
      expect(service.uploadDocuments).toHaveBeenCalledWith('verif1', 'u1', {
        documentFront: files.documentFront[0],
        documentBack: undefined,
        selfie: files.selfie[0],
      });
      expect(res).toEqual({ ok: true });
    });
  });

  describe('myStatus', () => {
    it('proxies to service', async () => {
      service.myStatus.mockResolvedValue({ status: 'PENDING' });
      const res = await controller.myStatus({ user: { id: 'u1' } } as any);
      expect(service.myStatus).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ status: 'PENDING' });
    });
  });

  describe('admin', () => {
    it('adminList forwards to service with defaults', async () => {
      service.adminList.mockResolvedValue([]);
      const res = await controller.adminList();
      expect(service.adminList).toHaveBeenCalled();
      expect(Array.isArray(res)).toBe(true);
    });

    it('adminReview forwards to service', async () => {
      service.adminReview.mockResolvedValue({ id: 'v1', status: 'VERIFIED' });
      const res = await controller.adminReview(
        'verif1',
        { user: { id: 'admin1' } } as any,
        { decision: 'VERIFIED' } as any,
      );
      expect(service.adminReview).toHaveBeenCalledWith('verif1', 'admin1', {
        decision: 'VERIFIED',
      });
      expect(res).toEqual({ id: 'v1', status: 'VERIFIED' });
    });
  });
});
