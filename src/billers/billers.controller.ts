import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillersService } from './billers.service';
import { ListBillersQueryDto } from './dto/list-billers-query.dto';
import { BillerResponseDto } from './dto/biller-response.dto';

@ApiTags('billers')
@ApiBearerAuth()
@Controller('billers')
@UseGuards(JwtAuthGuard)
export class BillersController {
  constructor(private readonly billersService: BillersService) {}

  @Get()
  @ApiOperation({ summary: "List PayPilot's biller catalogue" })
  @ApiOkResponse({ type: BillerResponseDto, isArray: true })
  async findAll(@Query() query: ListBillersQueryDto): Promise<BillerResponseDto[]> {
    const results = await this.billersService.findAll(query);
    return results.map((biller) =>
      plainToInstance(BillerResponseDto, biller, { excludeExtraneousValues: true }),
    );
  }
}
