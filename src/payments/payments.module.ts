import { Module } from '@nestjs/common';
import { BillsModule } from '../bills/bills.module';
import { StripeModule } from '../integrations/stripe/stripe.module';
import { PayLinkModule } from './pay-link.module';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';
import { PaymentsController } from './payments.controller';
import { BillPaymentsController } from './bill-payments.controller';
import { PayLinkController } from './pay-link.controller';

@Module({
  imports: [BillsModule, StripeModule, PayLinkModule],
  controllers: [PaymentsController, BillPaymentsController, PayLinkController],
  providers: [PaymentsService, SettlementService],
  exports: [PaymentsService, SettlementService],
})
export class PaymentsModule {}
