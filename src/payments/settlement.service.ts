import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import { DrizzleDb } from '../database/drizzle.types';
import { bills, billers, billerPushAttempts, payments } from '../database/schema';

// Pushes a Stripe-settled payment to the biller. There is no real gateway
// wired in: the PayHub (Novatti/ATX) agent account is locked on ATX's side
// (resultCode 4044 — "Agent Locked", confirmed with two different auth
// keys), and IIMMPACT was evaluated but not integrated. This always
// simulates a successful settlement instead of calling any external API,
// so the rest of the payment flow can be demoed end-to-end. Every attempt
// is still logged to biller_push_attempts (append-only — unlike MyPay's
// fact_payhub_details, which overwrites push status/response in place and
// loses retry history), clearly marked as mocked, and
// payments.billerPushStatus is updated to the latest attempt's outcome.
@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async settle(paymentId: number): Promise<void> {
    const [row] = await this.db
      .select({
        amount: payments.amount,
        billerAccountNumber: bills.billerAccountNumber,
        billerProductCode: billers.productCode,
      })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .innerJoin(billers, eq(bills.billerId, billers.id))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!row) {
      this.logger.error(`Cannot settle payment ${paymentId}: payment/bill/biller not found`);
      return;
    }

    const requestPayload = {
      accountNumber: row.billerAccountNumber,
      productCode: row.billerProductCode,
      amount: row.amount,
      mocked: true,
    };

    this.logger.warn(`Settlement for payment ${paymentId} was mocked — no biller API was called`);

    await this.db.insert(billerPushAttempts).values({
      paymentId,
      requestPayload,
      responsePayload: { mocked: true },
      resultCode: 'MOCKED',
      resultDescription: 'Mocked: no settlement gateway is wired in yet, this transaction was simulated',
      status: 'success',
    });

    await this.db
      .update(payments)
      .set({ billerPushStatus: 'success' })
      .where(eq(payments.id, paymentId));
  }
}
