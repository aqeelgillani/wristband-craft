import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterDto, LoginDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(dto: RegisterDto, role: 'user' | 'supplier' = 'user') {
    const existing = await this.prisma.profile.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.profile.create({
      data: {
        email: dto.email,
        password: passwordHash,
        fullName: dto.fullName,
      },
      include: { roles: true },
    });

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        role,
      },
    });

    const token = this.signToken(user.id, user.email, [role]);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: [role],
      },
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.profile.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const roles = user.roles.map((role) => role.role);
    const token = this.signToken(user.id, user.email, roles);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles,
      },
    };
  }

  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        roles: true,
      },
    });
  }

  signToken(userId: string, email: string, roles: string[]) {
    return this.jwtService.sign({ sub: userId, email, roles });
  }
}
