import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from '../integrations/stripe/stripe.module';
import { PaymentsService } from '../payments/payments.service';
import { SettlementService } from '../payments/settlement.service';

// Not wired into Swagger — Stripe calls this directly, signed with STRIPE_WEBHOOK_SECRET.
@ApiExcludeController()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly config: ConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly settlementService: SettlementService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');
    if (!webhookSecret) {
      // Fail closed: without a webhook secret we cannot verify the event
      // actually came from Stripe, so refuse to process anything.
      throw new ServiceUnavailableException('Stripe webhook is not configured yet');
    }

    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or request body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      this.logger.warn(`Rejected Stripe webhook: ${message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.updateStatusByStripePaymentIntentId(intent.id, 'succeeded');
        const payment = await this.paymentsService.findByStripePaymentIntentId(intent.id);
        if (payment) {
          // Push to the biller. Failures are logged to biller_push_attempts
          // and billerPushStatus, never thrown — the Stripe payment already
          // succeeded and this webhook must still 200 so Stripe stops retrying.
          await this.settlementService.settle(payment.id).catch((err) => {
            this.logger.error(`Settlement threw for payment ${payment.id}: ${err}`);
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.paymentsService.updateStatusByStripePaymentIntentId(intent.id, 'failed');
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }
}
