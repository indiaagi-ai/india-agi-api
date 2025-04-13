import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from 'src/scraper/scraper.module';
import { LlmModule } from 'src/llm/llm.module';

@Module({
  imports: [HttpModule, ScraperModule, LlmModule],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
