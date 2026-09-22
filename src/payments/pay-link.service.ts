import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface PayLinkPayload {
  typ: 'pay_link';
  userId: number;
  billId: number;
}

// A signed, standalone token for the "Pay Now" WhatsApp button — distinct
// from a Stripe Checkout Session id, which we deliberately don't put in the
// template. A Checkout Session expires in at most 24h, but a reminder can
// be sent days before its due date, so the link must survive until clicked.
// PayLinkController mints the actual Checkout Session at click time instead.
const PAY_LINK_TTL = '30d';

@Injectable()
export class PayLinkService {
  constructor(private readonly jwtService: JwtService) {}

  sign(userId: number, billId: number): string {
    const payload: PayLinkPayload = { typ: 'pay_link', userId, billId };
    return this.jwtService.sign(payload, { expiresIn: PAY_LINK_TTL });
  }

  verify(token: string): { userId: number; billId: number } {
    let payload: PayLinkPayload;
    try {
      payload = this.jwtService.verify<PayLinkPayload>(token);
    } catch {
      throw new UnauthorizedException('This payment link is invalid or has expired');
    }
    if (payload.typ !== 'pay_link') {
      throw new UnauthorizedException('This payment link is invalid or has expired');
    }
    return { userId: payload.userId, billId: payload.billId };
  }
}
