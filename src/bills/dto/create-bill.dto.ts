import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBillDto {
  @ApiProperty({ example: 1, description: 'ID of the biller from GET /billers' })
  @IsInt()
  @IsPositive()
  billerId!: number;

  @ApiProperty({ example: '123456789', description: "The user's account number with the biller" })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  billerAccountNumber!: string;

  @ApiProperty({ example: 'My TNB bill' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label!: string;

  @ApiProperty({
    example: 85.5,
    description: 'Estimated monthly commitment for this bill, entered by the user',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedMonthlyAmount!: number;
}
