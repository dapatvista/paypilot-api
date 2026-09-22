import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PayLinkService } from './pay-link.service';
import { PaymentsService } from './payments.service';

// Public (no auth) — this is the endpoint a WhatsApp reminder's "Pay Now"
// button hits. A fresh Stripe Checkout Session is created on click rather
// than at reminder-send time, since Checkout Sessions expire in <=24h and a
// reminder can sit unread for longer than that (see PayLinkService).
@ApiExcludeController()
@Controller('pay')
export class PayLinkController {
  constructor(
    private readonly payLinkService: PayLinkService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get(':token')
  @Redirect()
  async redirect(@Param('token') token: string): Promise<{ url: string; statusCode: number }> {
    const { userId, billId } = this.payLinkService.verify(token);
    const payment = await this.paymentsService.createCheckoutSessionForBill(userId, billId, {});
    return { url: payment.checkoutUrl, statusCode: 302 };
  }
}
