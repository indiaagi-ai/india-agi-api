import {
  Controller,
  Get,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ScraperService } from 'src/scraper/scraper.service';

@Controller('test')
export class TestController {
  private logger: Logger;
  constructor(private readonly scraperService: ScraperService) {
    this.logger = new Logger(TestController.name);
  }

  @Get('get-markdown-content')
  async getHtmlContent(@Query('pageURL') pageURL: string) {
    try {
      const htmlContent = await this.scraperService.getHtmlContent(pageURL);
      const cleanHtmlContent =
        this.scraperService.cleanHtmlContent(htmlContent);
      const markdownContent =
        this.scraperService.convertHtmlToMarkdown(cleanHtmlContent);
      return markdownContent;
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
