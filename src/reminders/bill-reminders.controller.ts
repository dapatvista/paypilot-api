import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { ReminderResponseDto } from './dto/reminder-response.dto';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('bills/:billId/reminder')
@UseGuards(JwtAuthGuard)
export class BillRemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a WhatsApp reminder for a bill via Teekrr' })
  @ApiCreatedResponse({ type: ReminderResponseDto })
  async create(
    @CurrentUser() user: User,
    @Param('billId', ParseIntPipe) billId: number,
    @Body() dto: CreateReminderDto,
  ): Promise<ReminderResponseDto> {
    const reminder = await this.remindersService.createForBill(user.id, billId, dto);
    return plainToInstance(ReminderResponseDto, reminder, { excludeExtraneousValues: true });
  }
}
