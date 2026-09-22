import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/schema';
import { PaymentsService } from './payments.service';
import { CreateBillPaymentDto } from './dto/create-bill-payment.dto';
import { CreateCheckoutSessionResponseDto, CreatePaymentResponseDto } from './dto/payment-response.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('bills/:billId/payments')
@UseGuards(JwtAuthGuard)
export class BillPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent to pay a connected bill' })
  @ApiCreatedResponse({ type: CreatePaymentResponseDto })
  async create(
    @CurrentUser() user: User,
    @Param('billId', ParseIntPipe) billId: number,
    @Body() dto: CreateBillPaymentDto,
  ): Promise<CreatePaymentResponseDto> {
    const payment = await this.paymentsService.createForBill(user.id, billId, dto);
    return plainToInstance(CreatePaymentResponseDto, payment, { excludeExtraneousValues: true });
  }

  @Post('checkout-session')
  @ApiOperation({
    summary: 'Create a hosted Stripe Checkout link for a bill — no login or app UI required',
  })
  @ApiCreatedResponse({ type: CreateCheckoutSessionResponseDto })
  async createCheckoutSession(
    @CurrentUser() user: User,
    @Param('billId', ParseIntPipe) billId: number,
    @Body() dto: CreateBillPaymentDto,
  ): Promise<CreateCheckoutSessionResponseDto> {
    const payment = await this.paymentsService.createCheckoutSessionForBill(user.id, billId, dto);
    return plainToInstance(CreateCheckoutSessionResponseDto, payment, { excludeExtraneousValues: true });
  }
}
