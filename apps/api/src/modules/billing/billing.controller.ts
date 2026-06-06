import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsString, MinLength } from 'class-validator';
import { TenantGuard } from '@common/guards/tenant.guard';
import { BillingService } from './billing.service';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { PortalSessionResponseDto } from './dto/portal-session-response.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(1)
  priceId!: string;
}

@Controller('billing')
@UseGuards(TenantGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  getSubscription(@Req() req: Request): Promise<SubscriptionResponseDto> {
    return this.billingService.getSubscription(req.member!.organizationId);
  }

  @Post('create-checkout-session')
  @HttpCode(HttpStatus.OK)
  createCheckoutSession(
    @Req() req: Request,
    @Body() dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponseDto> {
    return this.billingService.createCheckoutSession(
      req.member!.organizationId,
      req.member!.userId,
      dto.priceId,
    );
  }

  @Post('create-portal-session')
  @HttpCode(HttpStatus.OK)
  createPortalSession(@Req() req: Request): Promise<PortalSessionResponseDto> {
    return this.billingService.createPortalSession(req.member!.organizationId);
  }
}
