import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaymentResponseDto {
  @Expose()
  @ApiProperty()
  id!: number;

  @Expose()
  @ApiProperty()
  billId!: number;

  @Expose()
  @ApiProperty()
  amount!: string;

  @Expose()
  @ApiProperty()
  currency!: string;

  @Expose()
  @ApiProperty({ enum: ['pending', 'succeeded', 'failed', 'cancelled'] })
  status!: string;

  @Expose()
  @ApiProperty({ enum: ['pending', 'success', 'failed'] })
  billerPushStatus!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;
}

export class CreatePaymentResponseDto extends PaymentResponseDto {
  @Expose()
  @ApiProperty({ description: 'Pass to Stripe.js/Elements on the frontend to confirm payment' })
  clientSecret!: string;
}
