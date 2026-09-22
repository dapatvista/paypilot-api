import { Body, Controller, forwardRef, Get, HttpCode, HttpStatus, Inject, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { RemindersService } from '../reminders/reminders.service';
import {
  computeNextDueDate,
  computeReminderDate,
  formatHumanDate,
  toDateOnlyString,
  REMINDER_LEAD_DAYS,
} from './due-date.util';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { BillResponseDto } from './dto/bill-response.dto';

@ApiTags('bills')
@ApiBearerAuth()
@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  private readonly logger = new Logger(BillsController.name);

  constructor(
    private readonly billsService: BillsService,
    @Inject(forwardRef(() => RemindersService))
    private readonly remindersService: RemindersService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Connect a bill from a biller in PayPilot's catalogue, and auto-schedule its first reminder" })
  @ApiCreatedResponse({ type: BillResponseDto })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateBillDto,
  ): Promise<BillResponseDto> {
    const bill = await this.billsService.create(user.id, dto);
    await this.scheduleFirstReminder(user.id, user.name, bill);
    return plainToInstance(BillResponseDto, bill, { excludeExtraneousValues: true });
  }

  private async scheduleFirstReminder(
    userId: number,
    userName: string,
    bill: Awaited<ReturnType<BillsService['create']>>,
  ): Promise<void> {
    const dueDate = computeNextDueDate(bill.dueDayOfMonth);
    const reminderDate = computeReminderDate(dueDate, REMINDER_LEAD_DAYS);

    try {
      await this.remindersService.createForBill(userId, bill.id, {
        scheduledFor: reminderDate.toISOString(),
        templateParams: {
          customer_name: userName,
          biller_name: bill.biller.name,
          bill_label: bill.label,
          amount: bill.estimatedMonthlyAmount,
          due_date: formatHumanDate(dueDate),
        },
      });
      await this.billsService.markReminderScheduled(bill.id, toDateOnlyString(dueDate));
    } catch (err) {
      // Bill connection must succeed even if the reminder can't be
      // scheduled yet (e.g. TEEKRR_WHATSAPP_TEMPLATE_NAME not set) — the
      // recurring cron will pick this bill up on its next due cycle.
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Auto-reminder not scheduled for bill ${bill.id}: ${message}`);
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the current user's connected bills" })
  @ApiOkResponse({ type: BillResponseDto, isArray: true })
  async findAll(@CurrentUser() user: User): Promise<BillResponseDto[]> {
    const bills = await this.billsService.findAllByUser(user.id);
    return bills.map((bill) =>
      plainToInstance(BillResponseDto, bill, { excludeExtraneousValues: true }),
    );
  }
}
