import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrdersService } from './orders.service';
import { BulkOrderUpdateDto, CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.ordersService.findVisibleOrders(req.user);
  }

  @Get('mine')
  findMine(@Request() req: any) {
    return this.ordersService.findByUser(req.user.id);
  }

  @Patch('bulk')
  updateBulk(@Body() dto: BulkOrderUpdateDto) {
    return this.ordersService.updateBulk(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }
}
