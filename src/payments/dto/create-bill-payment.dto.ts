import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateBillPaymentDto {
  @ApiPropertyOptional({
    example: 85.5,
    description:
      "Amount to pay now. Defaults to the bill's estimatedMonthlyAmount if omitted.",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;
}
