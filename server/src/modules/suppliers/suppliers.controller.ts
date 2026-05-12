import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { SupplierRegisterDto } from './suppliers.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post('register')
  register(@Body() dto: SupplierRegisterDto) {
    return this.suppliersService.register(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@Request() req: any) {
    return this.suppliersService.findByUserId(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/pricing')
  getPricing(@Request() req: any) {
    return this.suppliersService.getPricing(req.user.id);
  }

  @Get(':supplierId/pricing')
  getPricingForSupplier(@Param('supplierId') supplierId: string) {
    return this.suppliersService.getPricingForSupplier(supplierId);
  }

  @Get()
  list() {
    return this.suppliersService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/pricing')
  updatePricing(@Request() req: any, @Body() dto: any) {
    return this.suppliersService.updatePricing(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/products')
  getMyProducts(@Request() req: any) {
    return this.suppliersService.getMyProducts(req.user.id);
  }

  @Get(':id/products')
  getSupplierProducts(@Param('id') id: string) {
    return this.suppliersService.getProductsBySupplierId(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/products')
  createProduct(@Request() req: any, @Body() dto: any) {
    return this.suppliersService.createProduct(req.user.id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me/products/:productId')
  updateProduct(@Request() req: any, @Param('productId') productId: string, @Body() dto: any) {
    return this.suppliersService.updateProduct(req.user.id, productId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('me/products/:productId')
  deleteProduct(@Request() req: any, @Param('productId') productId: string) {
    return this.suppliersService.deleteProduct(req.user.id, productId);
  }
}
