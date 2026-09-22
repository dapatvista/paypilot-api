import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class BillerResponseDto {
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

  @Expose()
  @ApiProperty({ nullable: true })
  productType!: string | null;

  @Expose()
  @ApiProperty({
    description: 'Dynamic bill-entry form schema for this biller',
    type: 'array',
    items: { type: 'object' },
    nullable: true,
  })
  formSchema!: unknown;

  @Expose()
  @ApiProperty({ nullable: true })
  logoUrl!: string | null;

  @Expose()
  @ApiProperty()
  status!: string;
}
