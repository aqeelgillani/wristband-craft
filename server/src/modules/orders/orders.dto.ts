import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  designId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  totalPrice: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  printType?: string;

  @IsOptional()
  @IsBoolean()
  hasSecureGuests?: boolean;

  @IsOptional()
  shippingAddress?: any;

  @IsOptional()
  extraCharges?: any;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  shippingAddress?: any;

  @IsOptional()
  extraCharges?: any;

  @IsOptional()
  @IsNumber()
  totalPrice?: number;
}

export class BulkOrderUpdateDto {
  @IsArray()
  orderIds: string[];

  @IsOptional()
  shippingAddress?: any;

  @IsOptional()
  extraCharges?: any;
}
