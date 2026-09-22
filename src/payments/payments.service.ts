import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { Payment, payments } from '../database/schema';
import { BillsService } from '../bills/bills.service';
import { STRIPE_CLIENT } from '../integrations/stripe/stripe.module';
import { CreateBillPaymentDto } from './dto/create-bill-payment.dto';

const CURRENCY = 'myr';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly billsService: BillsService,
  ) {}

  async createForBill(
    userId: number,
    billId: number,
    dto: CreateBillPaymentDto,
  ): Promise<Payment & { clientSecret: string }> {
    const bill = await this.billsService.findByIdForUser(billId, userId);
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const amount = dto.amount ?? Number(bill.estimatedMonthlyAmount);
    const amountInCents = Math.round(amount * 100);

    const [inserted] = await this.db
      .insert(payments)
      .values({
        userId,
        billId,
        amount: amount.toFixed(2),
        currency: CURRENCY,
      })
      .$returningId();

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: CURRENCY,
        automatic_payment_methods: { enabled: true },
        metadata: {
          paypilotPaymentId: String(inserted.id),
          paypilotBillId: String(billId),
          paypilotUserId: String(userId),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe request failed';
      this.logger.error(`Failed to create PaymentIntent for payment ${inserted.id}: ${message}`);
      await this.db.update(payments).set({ status: 'failed' }).where(eq(payments.id, inserted.id));
      throw new BadRequestException(message);
    }

    await this.db
      .update(payments)
      .set({ stripePaymentIntentId: intent.id })
      .where(eq(payments.id, inserted.id));

    const payment = await this.findByIdInternal(inserted.id);
    if (!payment) {
      throw new Error('Failed to load payment after creation');
    }

    return { ...payment, clientSecret: intent.client_secret as string };
  }

  async findAllByUser(userId: number): Promise<Payment[]> {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async findByStripePaymentIntentId(paymentIntentId: string): Promise<Payment | undefined> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return payment;
  }

  async updateStatusByStripePaymentIntentId(
    paymentIntentId: string,
    status: 'succeeded' | 'failed',
  ): Promise<void> {
    await this.db
      .update(payments)
      .set({ status })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));
  }

  private async findByIdInternal(id: number): Promise<Payment | undefined> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return payment;
  }
}
