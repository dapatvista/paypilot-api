import { Module } from '@nestjs/common';
import { StripeModule } from '../integrations/stripe/stripe.module';
import { PaymentsModule } from '../payments/payments.module';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [StripeModule, PaymentsModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
