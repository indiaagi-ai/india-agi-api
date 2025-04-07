import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { HttpModule } from '@nestjs/axios';
import { ScraperModule } from 'src/scraper/scraper.module';

@Module({
  imports: [HttpModule, ScraperModule],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
