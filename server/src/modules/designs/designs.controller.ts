import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DesignsService } from './designs.service';
import { CreateDesignDto } from './designs.dto';

@Controller('designs')
@UseGuards(AuthGuard('jwt'))
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateDesignDto) {
    return this.designsService.create(req.user.id, dto);
  }

  @Get('mine')
  mine(@Request() req: any) {
    return this.designsService.findMine(req.user.id);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.designsService.remove(req.user.id, id);
  }
}
