import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Stripe(config.getOrThrow<string>('stripe.secretKey')),
    },
  ],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
