import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ReminderResponseDto {
  @Expose()
  @ApiProperty()
  id!: number;

  @Expose()
  @ApiProperty()
  billId!: number;

  @Expose()
  @ApiProperty()
  scheduledFor!: Date;

  @Expose()
  @ApiProperty({ enum: ['scheduled', 'sent', 'cancelled', 'failed'] })
  status!: string;

  @Expose()
  @ApiProperty()
  createdAt!: Date;
}
