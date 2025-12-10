import { Module } from '@nestjs/common';
import { PerplexityService } from './perplexity.service';
import { PerplexityController } from './perplexity.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [PerplexityController],
  providers: [PerplexityService],
  exports: [PerplexityService],
})
export class PerplexityModule {}
