import { forwardRef, Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { UsersModule } from '../users/users.module';
import { TeekrrModule } from '../integrations/teekrr/teekrr.module';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { BillRemindersController } from './bill-reminders.controller';
import { ReminderSchedulerCron } from './reminder-scheduler.cron';

@Module({
  imports: [forwardRef(() => BillsModule), UsersModule, TeekrrModule],
  controllers: [RemindersController, BillRemindersController],
  providers: [RemindersService, ReminderSchedulerCron],
  exports: [RemindersService],
})
export class RemindersModule {}
