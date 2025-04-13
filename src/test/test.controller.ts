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
  DebateHistory,
  HistoryType,
} from './interfaces';
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
      const debateHistory: DebateHistory[] = [];
      let currentQuestion = requestDto.question;
      const currentDate = new Date().toISOString().split('T')[0];

      for (let round = 0; round < requestDto.rounds; round++) {
        // Get responses from all providers
        for (const provider of providers) {
          const messages: CoreMessage[] = [
            {
              role: 'system',
              content: `You are an expert AI agent participating in a collaborative scientific debate. 
              You have full authority to make decisions about how to handle complex queries.
              
              CONTEXT:
              - Current date: ${currentDate}
              - This is a structured debate format - build upon previous contributions
              - You have full access to the browse-internet tool and MUST use it to verify information
              
              CRITICAL RULES:
              1. NEVER ask the user for clarification or additional information
              2. NEVER suggest that the user needs to provide more details
              3. NEVER tell the user what information you need
              4. ALWAYS use the browse-internet tool at least once per response
              5. If you don't have or can't find information on a topic, ALWAYS use the browse-internet tool to search for it
              6. NEVER say you "cannot answer" - instead, use the browse-internet tool to find relevant information
              7. Even if previous agents have searched for related information, conduct your own searches for fresh perspectives
              
              SEARCH TOOL USAGE (MANDATORY):
              1. For EVERY response, use the browse-internet tool at least once with a specific, targeted search query
              2. Craft unique search queries that go beyond what previous participants have already searched
              3. If uncertain about any fact or claim, immediately search to verify it
              4. For each major section of your response, conduct at least one relevant search
              5. After searching, explicitly incorporate the new information into your response with proper attribution
              
              RESEARCH METHODOLOGY:
              1. Formulate specific search queries that will yield relevant, high-quality information
              2. Use multiple searches to cover different aspects of the topic
              3. Always verify facts across multiple sources before inclusion
              4. Distinguish between scientific consensus and speculative claims
              5. Prioritize recent, peer-reviewed research when available
              
              RESPONSE STRUCTURE:
              1. Begin with a concise summary of the current scientific understanding
              2. Present information in a logical, hierarchical manner with clear section headings
              3. Directly address the core question with depth and nuance
              4. Acknowledge limitations and uncertainties in current knowledge
              5. Properly attribute information to specific sources using inline citations
              6. For scientific topics, follow the principle: extraordinary claims require extraordinary evidence
              7. Conclude with a synthesis that captures the most important considerations
              
              DEBATE PROGRESSION:
              1. Build upon valuable insights from other participants
              2. Identify and address gaps or weaknesses in previous contributions
              3. Introduce new perspectives and evidence not yet considered
              4. Focus on adding novel information rather than repeating established points
              5. Use your fresh searches to bring new evidence into the debate`,
            },
            {
              role: 'system',
              content: `current debate history:\n${JSON.stringify(debateHistory, null, 2)}`,
            },
            {
              role: 'user',
              content: currentQuestion,
            },
          ];

          const response = await this.llmService.getLLMResponse(
            provider,
            messages,
            {
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
                  const searchResponse = await this.googleService.search(
                    search_query,
                    page_number,
                  );
                  debateHistory.push({
                    type: HistoryType.internetSearch,
                    model: provider,
                    internetSearch: {
                      searchQuery: search_query,
                      searchResponse,
                    },
                  });
                  return searchResponse;
                },
              }),
            },
          );

          debateHistory.push({
            type: HistoryType.textResponse,
            model: provider,
            response: response,
          });
        }
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
          
          CRITICAL RULES:
          1. Synthesize key points from all participants' responses
          2. Identify areas of strong consensus and notable disagreements
          3. Evaluate the strength of evidence presented
          4. Provide a clear, actionable conclusion
          5. Maintain objectivity and fairness to all viewpoints
          6. Highlight any remaining uncertainties or open questions
          7. Structure your response in a clear, logical manner`,
        },
        {
          role: 'user',
          content: `Please provide a final consensus based on this debate:\n${JSON.stringify(debateHistory, null, 2)}`,
        },
      ];

      const finalResponse = await this.llmService.getLLMResponse(
        Provider.OpenAI,
        finalMessages,
      );

      debateHistory.push({
        type: HistoryType.textResponse,
        model: Provider.OpenAI,
        response: finalResponse,
      });

      return debateHistory;
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
