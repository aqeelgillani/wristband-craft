import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SupplierRegisterDto {
  @IsString()
  companyName: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
