import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const rows = await this.prisma.availability.findMany({
      where: { userId },
      orderBy: { start: 'asc' },
      take: 200,
    });
    return rows;
  }

  async upsertSlot(
    userId: string,
    slot: {
      id?: string;
      start: string | Date;
      end: string | Date;
      timezone?: string;
    },
  ) {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (
      !(start instanceof Date) ||
      !(end instanceof Date) ||
      isNaN(start.getTime()) ||
      isNaN(end.getTime())
    ) {
      throw new InternalServerErrorException('Invalid start/end');
    }
    if (end <= start)
      throw new InternalServerErrorException('End must be after start');
    if (slot.id) {
      const updated = await this.prisma.availability.update({
        where: { id: slot.id },
        data: { start, end, timezone: slot.timezone ?? null },
      });
      return updated;
    }
    const created = await this.prisma.availability.create({
      data: { userId, start, end, timezone: slot.timezone ?? null },
    });
    return created;
  }

  async deleteSlot(userId: string, id: string) {
    // Ensure ownership
    const existing = await this.prisma.availability.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) return { deleted: false };
    await this.prisma.availability.delete({ where: { id } });
    return { deleted: true };
  }

  async checkConflict(userId: string, start: Date, end: Date) {
    const overlap = await this.prisma.availability.findFirst({
      where: {
        userId,
        NOT: [{ end: { lte: start } }, { start: { gte: end } }],
      },
    });
    return { hasConflict: Boolean(overlap) };
  }

  // Returns true if there's at least one availability slot fully covering [start, end]
  async hasAvailabilityCoverage(userId: string, start: Date, end: Date) {
    const slot = await this.prisma.availability.findFirst({
      where: {
        userId,
        start: { lte: start },
        end: { gte: end },
      },
    });
    return Boolean(slot);
  }
}
