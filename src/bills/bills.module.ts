import { forwardRef, Module } from '@nestjs/common';
import { BillersModule } from '../billers/billers.module';
import { RemindersModule } from '../reminders/reminders.module';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';

@Module({
  // RemindersModule also imports BillsModule (RemindersService needs
  // BillsService to look up a bill's owner) — forwardRef on both sides
  // breaks the circular-import deadlock. BillsController needs
  // RemindersService to auto-schedule a reminder when a bill is connected.
  imports: [BillersModule, forwardRef(() => RemindersModule)],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
