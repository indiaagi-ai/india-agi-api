import {
  Controller,
  Get,
  Query,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ScraperService } from 'src/scraper/scraper.service';
import { LlmService } from 'src/llm/llm.service';
import {
  TestLLMRequestDto,
  GoogleSearchRequestDto,
} from './interfaces/requests.dto';
import { CoreMessage, tool, ToolSet } from 'ai';
import { GoogleService } from 'src/google/google.service';

@Controller('test')
export class TestController {
  private logger: Logger;
  constructor(
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
    private readonly googleService: GoogleService,
  ) {
    this.logger = new Logger(TestController.name);
  }

  @Get('markdown-content')
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

  @Get('llm-response')
  async getLLMResponse(@Query() requestDto: TestLLMRequestDto) {
    try {
      const messages: CoreMessage[] = [
        {
          role: 'system',
          content: 'You are an helpful AI assistant',
        },
        {
          role: 'user',
          content: requestDto.message,
        },
      ];

      return await this.llmService.getLLMResponse(
        requestDto.provider,
        messages
      );
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }

  @Get('google-search')
  async googleSearch(@Query() requestDto: GoogleSearchRequestDto) {
    try {
      return await this.googleService.search(
        requestDto.searchQuery,
        requestDto.pageNumber,
      );
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
