import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { bills, billers, users } from '../database/schema';
import {
  computeNextDueDate,
  computeReminderDate,
  formatHumanDate,
  toDateOnlyString,
  REMINDER_LEAD_DAYS,
} from '../bills/due-date.util';
import { BillsService } from '../bills/bills.service';
import { RemindersService } from './reminders.service';

// Recurring counterpart to the one-shot reminder scheduled when a bill is
// connected (BillsController.scheduleFirstReminder): a monthly bill needs
// a new reminder every cycle, and Teekrr's own scheduler only fires
// one-time broadcasts — it doesn't know a bill recurs. This runs daily,
// finds bills exactly REMINDER_LEAD_DAYS from their next due date that
// haven't already gotten a reminder for that specific due date
// (bills.lastReminderForDueDate), and schedules one.
@Injectable()
export class ReminderSchedulerCron {
  private readonly logger = new Logger(ReminderSchedulerCron.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(forwardRef(() => BillsService)) private readonly billsService: BillsService,
    private readonly remindersService: RemindersService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async run(): Promise<void> {
    const rows = await this.db
      .select({
        billId: bills.id,
        billLabel: bills.label,
        estimatedMonthlyAmount: bills.estimatedMonthlyAmount,
        dueDayOfMonth: bills.dueDayOfMonth,
        lastReminderForDueDate: bills.lastReminderForDueDate,
        billerName: billers.name,
        userId: users.id,
        userName: users.name,
      })
      .from(bills)
      .innerJoin(billers, eq(bills.billerId, billers.id))
      .innerJoin(users, eq(bills.userId, users.id))
      .where(eq(bills.status, 'active'));

    let scheduled = 0;
    for (const row of rows) {
      const dueDate = computeNextDueDate(row.dueDayOfMonth);
      const dueDateStr = toDateOnlyString(dueDate);
      const daysUntilDue = Math.round((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

      if (daysUntilDue !== REMINDER_LEAD_DAYS) continue;
      if (row.lastReminderForDueDate === dueDateStr) continue;

      try {
        await this.remindersService.createForBill(row.userId, row.billId, {
          scheduledFor: computeReminderDate(dueDate, REMINDER_LEAD_DAYS).toISOString(),
          templateParams: {
            customer_name: row.userName,
            biller_name: row.billerName,
            bill_label: row.billLabel,
            amount: row.estimatedMonthlyAmount,
            due_date: formatHumanDate(dueDate),
          },
        });
        await this.billsService.markReminderScheduled(row.billId, dueDateStr);
        scheduled++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Recurring reminder not scheduled for bill ${row.billId}: ${message}`);
      }
    }

    if (scheduled > 0) {
      this.logger.log(`Recurring reminder sweep: scheduled ${scheduled} reminder(s)`);
    }
  }
}
