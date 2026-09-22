import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { StripeModule } from '../integrations/stripe/stripe.module';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';
import { PaymentsController } from './payments.controller';
import { BillPaymentsController } from './bill-payments.controller';

@Module({
  imports: [BillsModule, StripeModule],
  controllers: [PaymentsController, BillPaymentsController],
  providers: [PaymentsService, SettlementService],
  exports: [PaymentsService, SettlementService],
})
export class PaymentsModule {}
