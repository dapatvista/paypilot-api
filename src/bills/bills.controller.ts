import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { BillResponseDto } from './dto/bill-response.dto';

@ApiTags('bills')
@ApiBearerAuth()
@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  @ApiOperation({ summary: "Connect a bill from a biller in PayPilot's catalogue" })
  @ApiCreatedResponse({ type: BillResponseDto })
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateBillDto,
  ): Promise<BillResponseDto> {
    const bill = await this.billsService.create(user.id, dto);
    return plainToInstance(BillResponseDto, bill, { excludeExtraneousValues: true });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the current user's connected bills" })
  @ApiOkResponse({ type: BillResponseDto, isArray: true })
  async findAll(@CurrentUser() user: User): Promise<BillResponseDto[]> {
    const bills = await this.billsService.findAllByUser(user.id);
    return bills.map((bill) =>
      plainToInstance(BillResponseDto, bill, { excludeExtraneousValues: true }),
    );
  }
}
