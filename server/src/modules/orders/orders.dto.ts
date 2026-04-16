export class CreateOrderDto {
  userId: string;
  designId?: string;
  supplierId?: string;
  quantity: number;
  totalPrice: number;
  unitPrice?: number;
  basePrice?: number;
  status: string;
  paymentStatus?: string;
  currency: string;
  printType?: string;
  hasSecureGuests?: boolean;
  shippingAddress?: any;
  extraCharges?: any;
  adminNotes?: string;
}

export class UpdateOrderStatusDto {
  status: string;
  paymentStatus?: string;
  shippingAddress?: any;
  extraCharges?: any;
  totalPrice?: number;
}

export class BulkOrderUpdateDto {
  orderIds: string[];
  shippingAddress?: any;
  extraCharges?: any;
}
