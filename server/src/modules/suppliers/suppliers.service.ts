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
    });
  }

  async getPricingBySupplierId(supplierId: string) {
    return this.prisma.pricingConfig.findMany({
      where: { supplierId },
    });
  }

  async updatePricing(userId: string, dto: any) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    // dto should be an array of pricing configs or a single object.
    // If it's an array, we upsert them.
    const configs = Array.isArray(dto) ? dto : [dto];
    
    for (const config of configs) {
      if (config.id) {
        await this.prisma.pricingConfig.update({
          where: { id: config.id },
          data: { ...config, supplierId: supplier.id },
        });
      } else {
        await this.prisma.pricingConfig.create({
          data: { ...config, supplierId: supplier.id },
        });
      }
    }
    
    return this.prisma.pricingConfig.findMany({ where: { supplierId: supplier.id } });
  }

  async getProductsBySupplierId(supplierId: string) {
    return this.prisma.product.findMany({
      where: { supplierId, isActive: true },
      include: { pricingTiers: true },
      orderBy: { name: 'asc' },
    });
  }

  async getMyProducts(userId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');
    return this.prisma.product.findMany({
      where: { supplierId: supplier.id },
      include: { pricingTiers: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(userId: string, dto: any) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    const { pricingTiers, ...productData } = dto;
    const product = await this.prisma.product.create({
      data: { ...productData, supplierId: supplier.id },
    });

    if (Array.isArray(pricingTiers) && pricingTiers.length > 0) {
      await this.prisma.supplierPricingTier.createMany({
        data: pricingTiers.map((t: any) => ({ ...t, productId: product.id })),
      });
    }

    return this.prisma.product.findUnique({
      where: { id: product.id },
      include: { pricingTiers: true },
    });
  }

  async updateProduct(userId: string, productId: string, dto: any) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });
    if (!product) throw new BadRequestException('Product not found');

    const { pricingTiers, ...productData } = dto;
    await this.prisma.product.update({ where: { id: productId }, data: productData });

    if (Array.isArray(pricingTiers)) {
      await this.prisma.supplierPricingTier.deleteMany({ where: { productId } });
      if (pricingTiers.length > 0) {
        await this.prisma.supplierPricingTier.createMany({
          data: pricingTiers.map((t: any) => ({ ...t, productId })),
        });
      }
    }

    return this.prisma.product.findUnique({
      where: { id: productId },
      include: { pricingTiers: true },
    });
  }

  async deleteProduct(userId: string, productId: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { userId } });
    if (!supplier) throw new BadRequestException('Not a supplier');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, supplierId: supplier.id },
    });
    if (!product) throw new BadRequestException('Product not found');

    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true };
  }
}
