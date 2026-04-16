import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { AuthModule } from './modules/auth/auth.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { DesignsModule } from './modules/designs/designs.module';

@Module({
  imports: [PrismaModule, AuthModule, SuppliersModule, OrdersModule, ProfilesModule, DesignsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
