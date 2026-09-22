import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  @ApiProperty({
    example: 15,
    minimum: 1,
    maximum: 31,
    description:
      'Day of month this bill is typically due. Clamped to the actual days in a given month (e.g. 31 on a 30-day month means the 30th). Drives the auto-scheduled reminder.',
  })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOfMonth!: number;
}
