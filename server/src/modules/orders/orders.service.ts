import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkOrderUpdateDto, CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        ...createOrderDto,
        shippingAddress: createOrderDto.shippingAddress ? JSON.stringify(createOrderDto.shippingAddress) : undefined,
        extraCharges: createOrderDto.extraCharges ? JSON.stringify(createOrderDto.extraCharges) : undefined,
        createdAt: new Date(),
      },
      include: {
        user: { select: { email: true, fullName: true } },
        supplier: true,
        design: true,
      },
    });
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
      const supplierOrders = await this.prisma.order.findMany({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, fullName: true } },
          supplier: true,
          design: true,
        },
      });
      return supplierOrders.map((order) => ({
        ...order,
        shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
        extraCharges: order.extraCharges ? JSON.parse(order.extraCharges) : null,
      }));
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

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
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
