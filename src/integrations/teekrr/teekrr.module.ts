import { Global, Module } from '@nestjs/common';
import { TeekrrClient } from './teekrr.client';

@Global()
@Module({
  providers: [TeekrrClient],
  exports: [TeekrrClient],
})
export class TeekrrModule {}
