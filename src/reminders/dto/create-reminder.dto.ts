import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional } from 'class-validator';

export class CreateReminderDto {
  @ApiProperty({
    example: '2026-10-01T09:00:00.000Z',
    description: 'When Teekrr should send the WhatsApp reminder',
  })
  @IsISO8601()
  scheduledFor!: string;

  @ApiPropertyOptional({
    description:
      "Named variables for the approved WhatsApp template's placeholders (e.g. { customer_name: 'Amir', amount: '45.50' }). PayPilot does not assume a fixed template shape.",
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  templateParams?: Record<string, string>;
}
