import {
  Controller,
  Get,
  Query,
  Logger,
  BadRequestException,
  Sse,
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
import { Observable, Subject } from 'rxjs';

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

  @Sse('sse')
  sse(
    @Query() requestDto: CollaborativeLLMRequestDto,
  ): Observable<MessageEvent<DebateHistory>> {
    const subject = new Subject<MessageEvent<DebateHistory>>();
    const providers = [Provider.OpenAI, Provider.Google];
    const debateHistory: DebateHistory[] = [];
    const currentDate = new Date().toISOString().split('T')[0];

    const processRound = async (round: number, question: string) => {
      for (const provider of providers) {
        const messages: CoreMessage[] = [
          {
            role: 'system',
            content: `You are an expert AI agent (${provider}) participating in a collaborative scientific debate.

CORE IDENTITY:
- You are a thoughtful, evidence-driven debate participant designated as [AGENT ID].
- You possess specialized knowledge in [DOMAIN EXPERTISE], but maintain intellectual humility.
- Your goal is to advance collective understanding through reasoned discourse.

DEBATE CONTEXT:
- Current date: ${currentDate}
- Format: Structured multi-agent debate on scientific/technical topics
- Current Round: ${round} of ${rounds}
- Previous contributions are available for reference and building upon
- You have access to real-time information retrieval tools

CRITICAL RULES:

1. EVIDENCE-BASED REASONING
   - Always ground assertions in verifiable evidence
   - Use the browse-internet tool proactively for fact-checking and research
   - Cite specific sources with proper attribution (title, author, publication date, URL)
   - Conduct new searches even if related information has been previously presented

2. INTELLECTUAL INTEGRITY
   - Acknowledge uncertainty when appropriate
   - Never claim expertise you don't possess
   - If lacking information, use research tools rather than saying "cannot answer"
   - Update your position when presented with compelling evidence

3. DISCOURSE STRUCTURE
   - Begin responses with a clear position statement
   - Structure arguments with explicit premises and conclusions
   - Acknowledge and engage with strongest counterarguments
   - Conclude with synthesis of key points

4. COLLABORATIVE DYNAMICS
   - Build upon valid points made by other agents
   - Identify areas of agreement before addressing disagreements
   - Steelman rather than strawman opposing positions
   - Focus on advancing collective understanding, not "winning"

5. RESPONSE PROTOCOL
   - Maintain a respectful, scholarly tone throughout
   - End with 1-2 thoughtful questions that would advance the discussion

Remember: Your purpose is to help arrive at nuanced, evidence-based understanding through thoughtful dialogue. Prioritize truth-seeking over persuasion.`,
          },
        ];

        if (debateHistory.length === 0) {
          messages.push({
            role: 'user',
            content: `user query: ${question}`,
          });
        } else {
          debateHistory.forEach((element) => {
            let message = '';
            if (element.type === HistoryType.internetSearch) {
              message += `${element.model} searched internet for: ${element.internetSearch?.searchQuery}`;
              message += `\nsearch results: ${JSON.stringify(element.internetSearch?.searchResponse, null, 2)}`;
            }
            if (element.model === provider) {
              message += element.response;
              messages.push({
                role: 'assistant',
                content: message,
              });
            } else {
              message += element.response;
              messages.push({
                role: 'user',
                content: `${element.model} responded: ${message}`,
              });
            }
          });
          messages.push({
            role: 'user',
            content: `You are participating as ${provider} in this structured debate.

  YOUR IMMEDIATE TASKS:
  1. First, address the specific questions raised by other participants in the previous round. Provide direct, evidence-based answers to each question.
  2. Then, continue with your substantive contribution to the debate.

  YOUR DEBATE PARTICIPATION GUIDELINES:
  - Maintain your distinct perspective and expertise as ${provider}
  - Draw on your specialized knowledge
  - Reference and build upon valid points from previous speakers
  - Introduce new evidence or perspectives that advance the discussion
  - When citing research, provide complete citations with authors, year, and key findings
  - Highlight areas of agreement before addressing disagreements
  
  Remember to conduct relevant searches before making factual claims, even if you believe you already have the information.
  
  End your contribution with 1-2 thoughtful questions that would help clarify other participants' positions or advance the collective understanding.`,
          });
        }

        this.logger.verbose(JSON.stringify(messages, null, 2));
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
                const searchHistory: DebateHistory = {
                  type: HistoryType.internetSearch,
                  model: provider,
                  internetSearch: {
                    searchQuery: search_query,
                    searchResponse,
                  },
                };
                debateHistory.push(searchHistory);
                subject.next({
                  data: searchHistory,
                } as MessageEvent<DebateHistory>);
                return searchResponse;
              },
            }),
          },
        );

        const responseHistory: DebateHistory = {
          type: HistoryType.textResponse,
          model: provider,
          response: response,
        };
        debateHistory.push(responseHistory);
        subject.next({ data: responseHistory } as MessageEvent<DebateHistory>);
      }
    };

    // Start processing rounds
    const { question, rounds } = requestDto;

    void (async () => {
      try {
        for (let round = 0; round < rounds; round++) {
          await processRound(round, question);
        }

        // Get final consensus
        const finalMessages: CoreMessage[] = [
          {
            role: 'system',
            content: `You are the final autonomous arbiter in a collaborative debate. 
            Review all previous responses and provide a comprehensive, balanced consensus that captures the nuance of the discussion.`,
          },
        ];

        debateHistory.forEach((element) => {
          let message = '';
          if (element.type === HistoryType.internetSearch) {
            message = `${element.model} searched for ${element.internetSearch?.searchQuery}\n search response: ${JSON.stringify(element.internetSearch?.searchResponse, null, 2)}`;
          } else {
            message = `${element.model} replied: ${element.response}`;
          }
          finalMessages.push({
            role: 'user',
            content: message,
          });
        });

        finalMessages.push({
          role: 'user',
          content: `Based on the complete debate record above, please provide a final consensus that balances all perspectives while highlighting the strongest supported conclusions.`,
        });

        const finalResponse = await this.llmService.getLLMResponse(
          Provider.OpenAI,
          finalMessages,
        );

        const finalHistory: DebateHistory = {
          type: HistoryType.textResponse,
          model: Provider.OpenAI,
          response: finalResponse,
        };
        debateHistory.push(finalHistory);
        subject.next({ data: finalHistory } as MessageEvent<DebateHistory>);
        subject.complete();
      } catch (error) {
        this.logger.error((error as Error).message);
        subject.error(error);
      }
    })();

    return subject.asObservable();
  }
}
