import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { RemindersService } from './reminders.service';
import { ReminderResponseDto } from './dto/reminder-response.dto';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's scheduled reminders" })
  @ApiOkResponse({ type: ReminderResponseDto, isArray: true })
  async findAll(@CurrentUser() user: User): Promise<ReminderResponseDto[]> {
    const results = await this.remindersService.findAllByUser(user.id);
    return results.map((reminder) =>
      plainToInstance(ReminderResponseDto, reminder, { excludeExtraneousValues: true }),
    );
  }
}
