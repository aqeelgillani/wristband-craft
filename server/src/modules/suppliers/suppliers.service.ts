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
}
