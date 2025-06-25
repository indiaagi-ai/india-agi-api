import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from 'src/scraper/scraper.module';

@Module({
  imports: [HttpModule, ScraperModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
