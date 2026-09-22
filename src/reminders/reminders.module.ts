import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { UsersModule } from '../users/users.module';
import { TeekrrModule } from '../integrations/teekrr/teekrr.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { BillRemindersController } from './bill-reminders.controller';

@Module({
  imports: [BillsModule, UsersModule, TeekrrModule],
  controllers: [RemindersController, BillRemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
