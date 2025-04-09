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
import { z } from 'zod';

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
          content: `You are a helpful AI assistant with the ability to search the internet for current information.
      
      When you need to answer questions that require up-to-date information, facts, statistics, current events, or specific knowledge that might be beyond your training data:
      
      1. Use the browse-internet tool by providing a clear, specific search query
      2. Review the search results carefully before responding
      3. Cite your sources by including relevant URLs from the search results
      4. If the initial search doesn't provide sufficient information, you can:
         - Refine your search query with more specific terms
         - Request a different page of results using the page_number parameter
         - Break down complex questions into multiple targeted searches
      
      Example tool use:
      - For "What is the current population of Tokyo?", search with "current population Tokyo 2025 statistics"
      - For technical questions, include specific error messages or version numbers
      - For news events, include dates and key entities in your search
      
      Always prioritize providing accurate, up-to-date information and acknowledge when information might be incomplete or uncertain. For your context, today's date is ${new Date().toISOString().split('T')[0]}`,
        },
        {
          role: 'user',
          content: requestDto.message,
        },
      ];

      const tools: ToolSet = {
        'browse-internet': tool({
          description:
            'Search the internet for information on a specific query. Returns search results from Google with titles, descriptions, and URLs.',
          parameters: z.object({
            search_query: z
              .string()
              .describe(
                'The search query to look up on the internet. Be specific and include relevant keywords for better results.',
              ),
            page_number: z
              .number()
              .describe(
                'The page number of search results to retrieve. Starts at 0 for the first page of results.',
              ),
          }),
          execute: async ({ search_query, page_number }) => {
            return await this.googleService.search(search_query, page_number);
          },
        }),
      };

      return await this.llmService.getLLMResponse(
        requestDto.provider,
        messages,
        tools,
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
