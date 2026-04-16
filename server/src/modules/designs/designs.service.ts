import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDesignDto } from './designs.dto';

@Injectable()
export class DesignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateDesignDto) {
    return this.prisma.design.create({
      data: {
        userId,
        designUrl: dto.designUrl,
        wristbandColor: dto.wristbandColor,
        wristbandType: dto.wristbandType,
        customText: dto.customText,
        textColor: dto.textColor,
        textPosition: dto.textPosition ? JSON.stringify(dto.textPosition) : undefined,
      },
    });
  }

  async findMine(userId: string) {
    const designs = await this.prisma.design.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return designs.map((design) => ({
      ...design,
      textPosition: design.textPosition ? JSON.parse(design.textPosition) : null,
    }));
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.design.deleteMany({
      where: { id, userId },
    });
    return { deleted: result.count };
  }
}
