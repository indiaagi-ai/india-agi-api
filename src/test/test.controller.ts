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
import {
  TestLLMRequestDto,
  GoogleSearchRequestDto,
  CollaborativeLLMRequestDto,
} from './interfaces/requests.dto';
import { CoreMessage, tool, ToolSet } from 'ai';
import { GoogleService } from 'src/google/google.service';
import { z } from 'zod';
import { Provider } from 'src/llm/interfaces';

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

  @Post('collaborative-llm')
  async getCollaborativeLLMResponse(
    @Body() requestDto: CollaborativeLLMRequestDto,
  ) {
    try {
      const providers = [Provider.OpenAI, Provider.Google];
      const debateHistory: string[] = [];
      let currentQuestion = requestDto.question;
      const currentDate = new Date().toISOString().split('T')[0];

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

      for (let round = 0; round < requestDto.rounds; round++) {
        const responses: { provider: Provider; response: string }[] = [];

        // Get responses from all providers
        for (const provider of providers) {
          const messages: CoreMessage[] = [
            {
              role: 'system',
              content: `You are an autonomous AI agent participating in a collaborative debate. 
              You have full authority to make decisions about how to handle the query.
              
              CONTEXT:
              - Current date: ${currentDate}
              - This is a one-off query - you cannot ask for clarification
              - You have full access to the browse-internet tool
              
              CRITICAL RULES:
              1. NEVER ask the user for clarification or additional information
              2. NEVER suggest that the user needs to provide more details
              3. NEVER tell the user what information you need
              4. Make all decisions about research and response independently
              5. If the query is unclear, make reasonable assumptions and proceed
              6. If information is missing, use the browse-internet tool to find it
              7. Break down complex queries into multiple searches autonomously
              8. Always verify facts and cite sources
              9. If you can't verify something, clearly state it's your opinion
              10. Use the tool as many times as needed without asking for permission
              11. When researching, prioritize recent information (after ${currentDate})
              
              Current debate history: ${debateHistory.join('\n\n')}`,
            },
            {
              role: 'user',
              content: currentQuestion,
            },
          ];

          const response = await this.llmService.getLLMResponse(
            provider,
            messages,
            tools,
          );
          responses.push({ provider, response });
        }

        // Add responses to debate history with XML tags
        const roundResponses = responses.map(
          (r) => `<response provider="${r.provider}">\n${r.response}\n</response>`,
        );
        debateHistory.push(`<round number="${round + 1}">\n${roundResponses.join('\n')}\n</round>`);

        // Update question for next round
        currentQuestion = `Based on the previous responses, continue the debate autonomously. 
        Current date: ${currentDate}
        NEVER ask for user input or clarification.
        Use the browse-internet tool as needed to verify claims and gather information.
        Make independent decisions about what needs research.
        Previous responses:\n${roundResponses.join('\n\n')}`;
      }

      // Get final consensus
      const finalMessages: CoreMessage[] = [
        {
          role: 'system',
          content: `You are the final autonomous arbiter in a collaborative debate. 
          Review all previous responses and provide a comprehensive, balanced consensus.
          
          CONTEXT:
          - Current date: ${currentDate}
          - This is a one-off query - you cannot ask for clarification
          - You have full access to the browse-internet tool
          
          CRITICAL RULES:
          1. NEVER ask for user input or clarification
          2. Make all decisions about verification independently
          3. Use the browse-internet tool as many times as needed
          4. Only include points that have been verified with sources
          5. Acknowledge areas of agreement and disagreement
          6. Provide a clear, actionable conclusion based on verified information
          7. Cite all sources used in your response
          8. Make independent decisions about what aspects need additional research
          9. When researching, prioritize recent information (after ${currentDate})`,
        },
        {
          role: 'user',
          content: `Please provide a final consensus based on this debate:\n${debateHistory.join('\n\n')}`,
        },
      ];

      const finalResponse = await this.llmService.getLLMResponse(
        Provider.OpenAI,
        finalMessages,
        tools,
      );

      return {
        debateHistory: `<debate>\n${debateHistory.join('\n')}\n<consensus>\n${finalResponse}\n</consensus>\n</debate>`,
        finalConsensus: finalResponse,
      };
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
