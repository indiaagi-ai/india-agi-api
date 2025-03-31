import {
  Controller,
  Get,
  Query,
  Logger,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { ScraperService } from 'src/scraper/scraper.service';
import { LlmService } from 'src/llm/llm.service';
import { TestLLMRequestDto } from './interfaces/requests.dto';
import { Provider } from 'src/llm/interfaces';

@Controller('test')
export class TestController {
  private logger: Logger;
  constructor(
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
  ) {
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

  @Post('get-llm-response')
  async getLLMResponse(
    @Query('provider') provider: Provider,
    @Body() requestDto: TestLLMRequestDto,
  ) {
    try {
      return await this.llmService.getLLMResponse(provider, requestDto.message);
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
