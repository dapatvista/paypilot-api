import { Module } from '@nestjs/common';
import { BillersModule } from '../billers/billers.module';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';

@Module({
  imports: [BillersModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
