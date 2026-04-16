import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
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

  @Get()
  list() {
    return this.suppliersService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/pricing')
  getPricing(@Request() req: any) {
    return this.suppliersService.getPricing(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/pricing')
  updatePricing(@Request() req: any, @Body() dto: any) {
    return this.suppliersService.updatePricing(req.user.id, dto);
  }
}
