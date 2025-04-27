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
            const response = await this.googleService.search(
              search_query,
              page_number,
            );
            try {
              return response;
            } catch {
              return null;
            }
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
    const providers = [Provider.OpenAI, Provider.Google, Provider.Anthropic];
    const debateHistory: DebateHistory[] = [];
    const currentDate = new Date().toISOString().split('T')[0];

    const getModelName = (provider: Provider) => {
      switch (provider) {
        case Provider.OpenAI:
          return 'GPT';
        case Provider.Google:
          return 'Gemini';
        case Provider.Anthropic:
          return 'Claude';
        case Provider.xAI:
          return 'Grok';
      }
    };

    const processRound = async (round: number, question: string) => {
      for (const provider of providers) {
        const providerUpdate: DebateHistory = {
          type: HistoryType.providerUpdate,
          model: provider,
        };
        subject.next({
          data: providerUpdate,
        } as MessageEvent<DebateHistory>);

        const messages: CoreMessage[] = [
          {
            role: 'system',
            content: `You are an expert AI agent participating in a collaborative debate.

## Your Role
- Carefully analyze arguments before responding
- Steelman opposing viewpoints rather than attacking weak versions
- Present well-reasoned positions with relevant evidence
- Acknowledge limitations in your knowledge when appropriate

## Debate Context
- Previous contributions are available for reference and building upon
- You have access to real-time information retrieval tools (Current Date: ${currentDate})
- This is a structured dialogue aimed at deepening understanding

## Communication Principles
- Present complex ideas with clarity and precision
- Organize thoughts logically with clear transitions between points
- Use concrete examples to illustrate abstract concepts
- Acknowledge valid counterarguments and update your position accordingly
- Recognize areas of agreement before exploring differences
- Ask clarifying questions when faced with ambiguous claims

## Intellectual Standards
- Prioritize accuracy over persuasiveness
- Distinguish between facts, interpretations, and speculations
- Identify logical fallacies in arguments (including your own)
- Evaluate the quality and relevance of evidence 
- Consider multiple perspectives on complex issues

Remember: Your purpose is to help arrive at nuanced, evidence-based understanding through thoughtful dialogue. Prioritize truth-seeking over persuasion.

## WHEN TO USE 'browse-internet' tool
- Current events, breaking news, or recent developments
- Time-sensitive information (prices, statistics, deadlines)
- Specific facts that may have changed since your knowledge cutoff
- Subject-specific details outside your core knowledge base
- Verification of claims requiring current sources
- Questions about ongoing trends or evolving situations

## WHEN NOT TO USE 'browse-internet' tool
- General knowledge queries about established concepts
- Requests for logical reasoning or analysis
- Opinion-based questions or subjective assessments
- Creative content generation (stories, poetry, code)
- Well-documented historical events prior to your knowledge cutoff
- Philosophical or abstract discussions not requiring factual updates
- Mathematical proofs or theoretical computations`,
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
              message += `${getModelName(element.model)} searched internet for: ${element.internetSearch?.searchQuery}`;
              message += `\nsearch results: ${JSON.stringify(element.internetSearch?.searchResponse, null, 2)}`;
            } else if (element.type === HistoryType.textResponse) {
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
                  content: `${getModelName(element.model)} responded: ${message}`,
                });
              }
            }
          });
          messages.push({
            role: 'user',
            content: `Continue the collaborative debate with your next contribution.

## Response Parameters:
- Engage directly with the ongoing discussion without meta-commentary
- Address previous points substantively using evidence and reasoning
- Develop the most promising ideas further with additional support
- Identify and explore key areas of disagreement constructively
- Introduce relevant new perspectives when appropriate
- Maintain intellectual charity and good faith throughout

Your response should flow naturally as part of the existing conversation without any framing statements about your role or task.  Original user query: ${question}`,
          });
        }

        this.logger.verbose(JSON.stringify(messages, null, 2));
        const response = await this.llmService.getLLMResponse(
          provider,
          messages,
          {
            'browse-internet': tool({
              description: `## PURPOSE
Access up-to-date information from across the web via Google search, returning titles, descriptions, and URLs.

## WHEN TO USE
- Current events, breaking news, or recent developments
- Time-sensitive information (prices, statistics, deadlines)
- Specific facts that may have changed since your knowledge cutoff
- Subject-specific details outside your core knowledge base
- Verification of claims requiring current sources
- Questions about ongoing trends or evolving situations

## WHEN NOT TO USE
- General knowledge queries about established concepts
- Requests for logical reasoning or analysis
- Opinion-based questions or subjective assessments
- Creative content generation (stories, poetry, code)
- Well-documented historical events prior to your knowledge cutoff
- Philosophical or abstract discussions not requiring factual updates
- Mathematical proofs or theoretical computations`,
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
          // Get final consensus
          const finalMessages: CoreMessage[] = [
            {
              role: 'system',
              content: `You are the final autonomous arbiter in a collaborative debate. 
            Review all previous responses and provide a comprehensive, balanced consensus that captures the nuance of the discussion. Your response should flow naturally as part of the existing conversation without any framing statements about your role or task.`,
            },
          ];

          debateHistory.forEach((element) => {
            let message = '';
            if (element.type === HistoryType.internetSearch) {
              message = `${getModelName(element.model)} searched for ${element.internetSearch?.searchQuery}\n search response: ${JSON.stringify(element.internetSearch?.searchResponse, null, 2)}`;
            } else {
              message = `${getModelName(element.model)} replied: ${element.response}`;
            }
            finalMessages.push({
              role: 'user',
              content: message,
            });
          });

          finalMessages.push({
            role: 'user',
            content: `Based on the complete debate record above, please provide a final consensus that balances all perspectives while highlighting the strongest supported conclusions. Your response should flow naturally as part of the existing conversation without any framing statements about your role or task. Original user query: ${question}`,
          });

          const providerUpdate: DebateHistory = {
            type: HistoryType.providerUpdate,
            model: Provider.xAI,
          };

          subject.next({
            data: providerUpdate,
          } as MessageEvent<DebateHistory>);

          const finalResponse = await this.llmService.getLLMResponse(
            Provider.xAI,
            finalMessages,
          );

          const finalHistory: DebateHistory = {
            type: HistoryType.textResponse,
            model: Provider.xAI,
            response: finalResponse,
          };
          debateHistory.push(finalHistory);
          subject.next({ data: finalHistory } as MessageEvent<DebateHistory>);

          const roundUpdate: DebateHistory = {
            type: HistoryType.roundUpdate,
            model: Provider.xAI,
            roundNumber: round + 1,
          };
          subject.next({
            data: roundUpdate,
          } as MessageEvent<DebateHistory>);
        }

        subject.complete();
      } catch (error) {
        this.logger.error((error as Error).message);
        subject.error(error);
      }
    })();

    return subject.asObservable();
  }
}
