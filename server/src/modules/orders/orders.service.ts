import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkOrderUpdateDto, CreateOrderDto, UpdateOrderStatusDto, UpdateShipmentDto } from './orders.dto';

const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.PLACED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.IN_PRODUCTION, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PRODUCTION]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeStatus(status?: string): string {
    return (status || '').trim().toUpperCase();
  }

  private validateTransition(fromStatus: string, toStatus: string) {
    const normalizedFrom = this.normalizeStatus(fromStatus);
    const normalizedTo = this.normalizeStatus(toStatus);
    const allowed = ALLOWED_TRANSITIONS[normalizedFrom];
    if (!allowed) {
      throw new BadRequestException(`Unsupported current order status: ${fromStatus}`);
    }
    if (!allowed.includes(normalizedTo)) {
      throw new BadRequestException(
        `Invalid status transition from ${normalizedFrom} to ${normalizedTo}`,
      );
    }
  }

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

    const initialStatus = this.normalizeStatus(createOrderDto.status) || ORDER_STATUS.PLACED;

    if (initialStatus !== ORDER_STATUS.DRAFT && initialStatus !== ORDER_STATUS.PLACED) {
      throw new BadRequestException('New orders can only start as DRAFT or PLACED');
    }

    try {
      const created = await this.prisma.order.create({
        data: {
          userId,
          designId,
          supplierId,
          quantity: Math.round(createOrderDto.quantity),
          totalPrice: createOrderDto.totalPrice,
          unitPrice: createOrderDto.unitPrice ?? undefined,
          basePrice: createOrderDto.basePrice ?? undefined,
          status: initialStatus,
          paymentStatus: createOrderDto.paymentStatus,
          currency: createOrderDto.currency,
          printType: createOrderDto.printType,
          hasSecureGuests: createOrderDto.hasSecureGuests,
          adminNotes: createOrderDto.adminNotes,
          customizationNotes: customizationNotes ?? undefined,
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : undefined,
          extraCharges: extraCharges != null ? JSON.stringify(extraCharges) : undefined,
          pricingSnapshotJson:
            extraCharges != null ? JSON.stringify(extraCharges) : JSON.stringify({}),
          designSnapshotJson: JSON.stringify({ designId }),
          createdAt: new Date(),
        },
        include: {
          user: { select: { email: true, fullName: true } },
          supplier: true,
          design: true,
        },
      });

      await this.prisma.orderStatusHistory.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: created.status,
          note: 'Order created',
          updatedByUserId: userId,
        },
      });

      return created;
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

    const nextStatus = this.normalizeStatus(updateOrderStatusDto.status);
    this.validateTransition(order.status, nextStatus);

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: nextStatus,
        paymentStatus: updateOrderStatusDto.paymentStatus,
        shippingAddress: updateOrderStatusDto.shippingAddress
          ? JSON.stringify(updateOrderStatusDto.shippingAddress)
          : undefined,
        extraCharges: updateOrderStatusDto.extraCharges
          ? JSON.stringify(updateOrderStatusDto.extraCharges)
          : undefined,
        totalPrice: updateOrderStatusDto.totalPrice,
        shippedAt: nextStatus === ORDER_STATUS.SHIPPED ? new Date() : undefined,
        deliveredAt: nextStatus === ORDER_STATUS.DELIVERED ? new Date() : undefined,
      },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: nextStatus,
        note: updateOrderStatusDto.note,
        updatedByUserId: user.id,
      },
    });

    return updatedOrder;
  }

  async updateShipment(id: string, dto: UpdateShipmentDto, user: { id: string; roles: string[] }) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.roles.includes('admin')) {
      // ok
    } else if (user.roles.includes('supplier')) {
      const supplier = await this.prisma.supplier.findUnique({ where: { userId: user.id } });
      if (!supplier || order.supplierId !== supplier.id) {
        throw new ForbiddenException('You can only update shipment for your orders');
      }
    } else {
      throw new ForbiddenException('Only supplier/admin can update shipment');
    }

    const hasTrackingUpdate = Boolean(dto.trackingNumber || dto.trackingUrl || dto.courier);
    const nextStatus =
      hasTrackingUpdate && order.status !== ORDER_STATUS.SHIPPED && order.status !== ORDER_STATUS.DELIVERED
        ? ORDER_STATUS.SHIPPED
        : null;

    if (nextStatus) {
      this.validateTransition(order.status, nextStatus);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        trackingNumber: dto.trackingNumber ?? undefined,
        trackingUrl: dto.trackingUrl ?? undefined,
        courier: dto.courier ?? undefined,
        estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : undefined,
        status: nextStatus ?? undefined,
        shippedAt: nextStatus === ORDER_STATUS.SHIPPED ? new Date() : undefined,
      },
    });

    await this.prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: nextStatus ?? order.status,
        note: dto.note || 'Shipment details updated',
        updatedByUserId: user.id,
      },
    });

    return updatedOrder;
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

  async getTimeline(orderId: string, user: { id: string; roles: string[] }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.roles.includes('admin')) {
      // Allowed
    } else if (user.roles.includes('supplier')) {
      const supplier = await this.prisma.supplier.findUnique({ where: { userId: user.id } });
      if (!supplier || order.supplierId !== supplier.id) {
        throw new ForbiddenException('You can only view timeline for your orders');
      }
    } else if (order.userId !== user.id) {
      throw new ForbiddenException();
    }

    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteDraft(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.status !== ORDER_STATUS.DRAFT) {
      throw new BadRequestException('Only DRAFT orders can be deleted');
    }
    await this.prisma.order.delete({ where: { id: orderId } });
    return { success: true };
  }

  async getTracking(orderId: string, user: { id: string; roles: string[] }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        supplierId: true,
        status: true,
        trackingNumber: true,
        trackingUrl: true,
        courier: true,
        estimatedDelivery: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (user.roles.includes('admin')) {
      // Allowed
    } else if (user.roles.includes('supplier')) {
      const supplier = await this.prisma.supplier.findUnique({ where: { userId: user.id } });
      if (!supplier || order.supplierId !== supplier.id) {
        throw new ForbiddenException('You can only view tracking for your orders');
      }
    } else if (order.userId !== user.id) {
      throw new ForbiddenException('You can only view tracking for your own orders');
    }

    return {
      orderId: order.id,
      status: order.status,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      courier: order.courier,
      estimatedDelivery: order.estimatedDelivery,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
    };
  }
}
