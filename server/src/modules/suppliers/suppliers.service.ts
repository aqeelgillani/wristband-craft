import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplierRegisterDto } from './suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(dto: SupplierRegisterDto) {
    const existing = await this.prisma.profile.findUnique({ where: { email: dto.contactEmail } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.profile.create({
        data: {
          email: dto.contactEmail,
          password: passwordHash,
          fullName: dto.companyName,
        },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          role: 'supplier',
        },
      });

      const supplier = await prisma.supplier.create({
        data: {
          userId: user.id,
          companyName: dto.companyName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          address: dto.address,
        },
      });

      return { user, supplier };
    });

    const accessToken = this.jwtService.sign({ sub: created.user.id, email: created.user.email, roles: ['supplier'] });

    return {
      accessToken,
      user: {
        id: created.user.id,
        email: created.user.email,
        fullName: created.user.fullName,
        roles: ['supplier'],
      },
      supplier: created.supplier,
    };
  }

  async findByUserId(userId: string) {
    return this.prisma.supplier.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async findAll() {
    return this.prisma.supplier.findMany({
      orderBy: { companyName: 'asc' },
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
      },
    });
  }

  async getPricing(userId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    return this.prisma.pricingConfig.findMany({
      where: { supplierId: supplier.id },
      orderBy: { wristbandType: 'asc' },
    });
  }

  async getPricingForSupplier(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new BadRequestException('Supplier not found');

    return this.prisma.pricingConfig.findMany({
      where: { supplierId },
      orderBy: { wristbandType: 'asc' },
    });
  }

  async updatePricing(userId: string, dto: any) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    // If it's a single object, first check if a config for this wristband type already exists
    if (!Array.isArray(dto)) {
      const existingConfig = await this.prisma.pricingConfig.findFirst({
        where: { supplierId: supplier.id, wristbandType: dto.wristbandType },
      });

      if (existingConfig) {
        await this.prisma.pricingConfig.update({
          where: { id: existingConfig.id },
          data: { ...dto, supplierId: supplier.id },
        });
      } else {
        await this.prisma.pricingConfig.create({
          data: { ...dto, supplierId: supplier.id },
        });
      }
    } else {
      // Handle array of configs
      const configs = dto as any[];
      for (const config of configs) {
        if (config.id) {
          await this.prisma.pricingConfig.update({
            where: { id: config.id },
            data: { ...config, supplierId: supplier.id },
          });
        } else {
          const existingConfig = await this.prisma.pricingConfig.findFirst({
            where: { supplierId: supplier.id, wristbandType: config.wristbandType },
          });
          if (existingConfig) {
            await this.prisma.pricingConfig.update({
              where: { id: existingConfig.id },
              data: { ...config, supplierId: supplier.id },
            });
          } else {
            await this.prisma.pricingConfig.create({
              data: { ...config, supplierId: supplier.id },
            });
          }
        }
      }
    }
    
    return this.prisma.pricingConfig.findMany({ 
      where: { supplierId: supplier.id },
      orderBy: { wristbandType: 'asc' },
    });
  }
}
