import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { PaymentsService } from './payments.service';
import { PaymentResponseDto } from './dto/payment-response.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's payment history" })
  @ApiOkResponse({ type: PaymentResponseDto, isArray: true })
  async findAll(@CurrentUser() user: User): Promise<PaymentResponseDto[]> {
    const results = await this.paymentsService.findAllByUser(user.id);
    return results.map((payment) =>
      plainToInstance(PaymentResponseDto, payment, { excludeExtraneousValues: true }),
    );
  }
}
