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
  hasSecureGuest?: boolean;
  shippingAddress?: any;
  extraCharges?: any;
  adminNotes?: string;
}

export class UpdateOrderStatusDto {
  status: string;
  paymentStatus?: string;
}
