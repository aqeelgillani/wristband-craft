import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkOrderUpdateDto, CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { customizationNotes, userId: _uid, shippingAddress, extraCharges } = createOrderDto;
    const designId = createOrderDto.designId?.trim() || undefined;
    const supplierId = createOrderDto.supplierId?.trim() || undefined;

    if (designId) {
      const design = await this.prisma.design.findFirst({ where: { id: designId, userId } });
      if (!design) {
        throw new BadRequestException('Design not found or you do not have access to it');
      }
    }
    if (supplierId) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!sup) {
        throw new BadRequestException('Invalid supplier. Add a supplier in the app or select one from the list.');
      }
    }

    if (!Number.isFinite(createOrderDto.quantity) || !Number.isFinite(createOrderDto.totalPrice)) {
      throw new BadRequestException('Order quantity and total must be valid numbers');
    }

    try {
      return await this.prisma.order.create({
        data: {
          userId,
          designId,
          supplierId,
          quantity: Math.round(createOrderDto.quantity),
          totalPrice: createOrderDto.totalPrice,
          unitPrice: createOrderDto.unitPrice ?? undefined,
          basePrice: createOrderDto.basePrice ?? undefined,
          status: createOrderDto.status,
          paymentStatus: createOrderDto.paymentStatus,
          currency: createOrderDto.currency,
          printType: createOrderDto.printType,
          hasSecureGuests: createOrderDto.hasSecureGuests,
          adminNotes: createOrderDto.adminNotes,
          customizationNotes: customizationNotes ?? undefined,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : undefined,
          extraCharges: extraCharges != null ? JSON.stringify(extraCharges) : undefined,
          createdAt: new Date(),
        },
        include: {
          user: { select: { email: true, fullName: true } },
          supplier: true,
          design: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new BadRequestException(
          'Order could not be created: check that a supplier is selected and your design is saved. If this persists, ensure the API database is migrated (run Prisma migrate in the server folder).',
        );
      }
      throw e;
    }
  }

  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: {
        user: true,
        supplier: true,
        design: true,
      },
    });
    return orders.map((order) => ({
      ...order,
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
      extraCharges: order.extraCharges ? JSON.parse(order.extraCharges) : null,
    }));
  }

  async findVisibleOrders(user: { id: string; roles: string[] }) {
    if (user.roles.includes('admin')) {
      return this.findAll();
    }

    if (user.roles.includes('supplier')) {
      const supplier = await this.prisma.supplier.findUnique({ where: { userId: user.id } });
      if (!supplier) return [];
      const allOrders = await this.prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, fullName: true } },
          supplier: true,
          design: true,
        },
      });
      return allOrders.map((order) => {
        const parsed = {
          ...order,
          shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
          extraCharges: order.extraCharges ? JSON.parse(order.extraCharges) : null,
        };
        if (order.supplierId === supplier.id) {
          return { ...parsed, canManage: true, visibility: 'fulfillment' as const };
        }
        return {
          ...parsed,
          canManage: false,
          visibility: 'platform' as const,
          user: { email: '—', fullName: null as string | null },
          shippingAddress: null,
          customizationNotes: null,
        };
      });
    }

    return this.findByUser(user.id);
  }

  async findByUser(userId: string) {
    const userOrders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        design: true,
        supplier: true,
      },
    });
    return userOrders.map((order) => ({
      ...order,
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
      extraCharges: order.extraCharges ? JSON.parse(order.extraCharges) : null,
    }));
  }

  async updateStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    user: { id: string; roles: string[] },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.roles.includes('admin')) {
      // ok
    } else if (user.roles.includes('supplier')) {
      const supplier = await this.prisma.supplier.findUnique({ where: { userId: user.id } });
      if (!supplier || order.supplierId !== supplier.id) {
        throw new ForbiddenException('You can only update orders fulfilled by you');
      }
    } else if (order.userId !== user.id) {
      throw new ForbiddenException();
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: updateOrderStatusDto.status,
        paymentStatus: updateOrderStatusDto.paymentStatus,
        shippingAddress: updateOrderStatusDto.shippingAddress
          ? JSON.stringify(updateOrderStatusDto.shippingAddress)
          : undefined,
        extraCharges: updateOrderStatusDto.extraCharges
          ? JSON.stringify(updateOrderStatusDto.extraCharges)
          : undefined,
        totalPrice: updateOrderStatusDto.totalPrice,
      },
    });
  }

  async updateBulk(dto: BulkOrderUpdateDto) {
    const updates = await Promise.all(
      dto.orderIds.map((id) =>
        this.prisma.order.update({
          where: { id },
          data: {
            shippingAddress: dto.shippingAddress ? JSON.stringify(dto.shippingAddress) : undefined,
            extraCharges: dto.extraCharges ? JSON.stringify(dto.extraCharges) : undefined,
          },
        }),
      ),
    );
    return { updated: updates.length };
  }
}
