import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { Reminder, reminders } from '../database/schema';
import { BillsService } from '../bills/bills.service';
import { UsersService } from '../users/users.service';
import { TeekrrClient, TeekrrNotConfiguredError } from '../integrations/teekrr/teekrr.client';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly teekrr: TeekrrClient,
    private readonly billsService: BillsService,
    private readonly usersService: UsersService,
  ) {}

  async createForBill(userId: number, billId: number, dto: CreateReminderDto): Promise<Reminder> {
    const bill = await this.billsService.findByIdForUser(billId, userId);
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let broadcastUuid: string;
    try {
      const result = await this.teekrr.scheduleWhatsAppReminder({
        recipient: user.mobile,
        scheduledAt: dto.scheduledFor,
        campaignName: `paypilot-bill-${billId}-reminder`,
        templateParams: dto.templateParams,
      });
      broadcastUuid = result.broadcastUuid;
    } catch (err) {
      if (err instanceof TeekrrNotConfiguredError) {
        throw new ServiceUnavailableException(
          'WhatsApp reminders are not configured yet (no approved template name set)',
        );
      }
      const message = err instanceof Error ? err.message : 'Teekrr request failed';
      throw new BadRequestException(message);
    }

    const [inserted] = await this.db
      .insert(reminders)
      .values({
        userId,
        billId,
        scheduledFor: new Date(dto.scheduledFor),
        externalMessageRef: broadcastUuid,
      })
      .$returningId();

    const created = await this.findByIdInternal(inserted.id);
    if (!created) {
      throw new Error('Failed to load reminder after creation');
    }
    return created;
  }

  async findAllByUser(userId: number): Promise<Reminder[]> {
    return this.db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, userId))
      .orderBy(desc(reminders.scheduledFor));
  }

  private async findByIdInternal(id: number): Promise<Reminder | undefined> {
    const [reminder] = await this.db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
    return reminder;
  }
}
