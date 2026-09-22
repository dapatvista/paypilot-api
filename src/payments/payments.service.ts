import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, isNull } from 'drizzle-orm';
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
    private readonly config: ConfigService,
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

    const payment = await this.findById(inserted.id);
    if (!payment) {
      throw new Error('Failed to load payment after creation');
    }

    return { ...payment, clientSecret: intent.client_secret as string };
  }

  // A hosted, standalone Stripe Checkout page for the bill — no login, no
  // app UI required. Distinct from createForBill (which returns a
  // clientSecret for our own in-app Elements form): this returns a URL the
  // recipient can open directly, e.g. from a WhatsApp reminder.
  //
  // Unlike a directly-created PaymentIntent, a Checkout Session's
  // `payment_intent` is NOT populated at creation time (confirmed live —
  // it's null until the customer actually reaches the payment step), so
  // there is nothing to store in payments.stripePaymentIntentId yet.
  // `payment_intent_data.metadata` carries our correlation IDs onto the
  // PaymentIntent once Stripe does create it; the webhook backfills
  // stripePaymentIntentId from that metadata the first time it sees an
  // event for a payment_intent we don't recognize (see
  // resolvePaymentIdFromIntent in StripeWebhookController). Everything
  // downstream of that point — status update, settlement — is identical
  // to the Elements flow.
  async createCheckoutSessionForBill(
    userId: number,
    billId: number,
    dto: CreateBillPaymentDto,
  ): Promise<Payment & { checkoutUrl: string }> {
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

    const webUrl = this.config.getOrThrow<string>('corsOrigin');
    const metadata = {
      paypilotPaymentId: String(inserted.id),
      paypilotBillId: String(billId),
      paypilotUserId: String(userId),
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: CURRENCY,
              unit_amount: amountInCents,
              product_data: { name: bill.label },
            },
          },
        ],
        success_url: `${webUrl}/dashboard?checkout=success`,
        cancel_url: `${webUrl}/dashboard?checkout=cancelled`,
        metadata,
        payment_intent_data: { metadata },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe request failed';
      this.logger.error(`Failed to create Checkout Session for payment ${inserted.id}: ${message}`);
      await this.db.update(payments).set({ status: 'failed' }).where(eq(payments.id, inserted.id));
      throw new BadRequestException(message);
    }

    if (!session.url) {
      this.logger.error(`Checkout Session ${session.id} missing url`);
      await this.db.update(payments).set({ status: 'failed' }).where(eq(payments.id, inserted.id));
      throw new Error('Stripe did not return a usable Checkout Session');
    }

    const payment = await this.findById(inserted.id);
    if (!payment) {
      throw new Error('Failed to load payment after creation');
    }

    return { ...payment, checkoutUrl: session.url };
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

  // Backfills stripePaymentIntentId for a payment created via
  // createCheckoutSessionForBill, the first time a webhook event arrives
  // for a payment_intent id we haven't seen yet (see the Checkout Session
  // comment above). Only ever sets it once — a payment_intent id is
  // permanent, so there is nothing to overwrite on a later event.
  async linkPaymentIntentIfMissing(paymentId: number, paymentIntentId: string): Promise<void> {
    await this.db
      .update(payments)
      .set({ stripePaymentIntentId: paymentIntentId })
      .where(and(eq(payments.id, paymentId), isNull(payments.stripePaymentIntentId)));
  }

  async findById(id: number): Promise<Payment | undefined> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return payment;
  }
}
