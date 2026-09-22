import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class BillBillerSummaryDto {
  @Expose()
  @ApiProperty()
  id!: number;

  @Expose()
  @ApiProperty()
  name!: string;

  @Expose()
  @ApiProperty()
  category!: string;

  @Expose()
  @ApiProperty()
  productCode!: string;
}

@Exclude()
export class BillResponseDto {
  @Expose()
  @ApiProperty()
  id!: number;

  @Expose()
  @ApiProperty()
  label!: string;

  @Expose()
  @ApiProperty()
  billerAccountNumber!: string;

  @Expose()
  @ApiProperty({ description: 'Estimated monthly commitment entered by the user' })
  estimatedMonthlyAmount!: string;

  @Expose()
  @ApiProperty()
  status!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;

  @Expose()
  @Type(() => BillBillerSummaryDto)
  @ApiProperty({ type: BillBillerSummaryDto })
  biller!: BillBillerSummaryDto;
}
