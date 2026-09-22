import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@Controller()
export class AppController {
  @Get('health')
  @SkipThrottle()
  @ApiExcludeEndpoint()
  health() {
    return { status: 'ok', service: 'paypilot-api', timestamp: new Date().toISOString() };
  }
}
