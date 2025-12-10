import {
  Controller,
  Get,
  Query,
  Logger,
  BadRequestException,
  Sse,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { ScraperService } from 'src/scraper/scraper.service';
import { LlmService } from 'src/llm/llm.service';
import {
  TestLLMRequestDto,
  GoogleSearchRequestDto,
  CollaborativeLLMRequestDto,
  DebateHistory,
  HistoryType,
  TextToSpeechRequest,
} from './interfaces';
import { CoreMessage, tool, ToolSet } from 'ai';
import { GoogleService } from 'src/google/google.service';
import { z } from 'zod';
import { Provider } from 'src/llm/interfaces';
import { Observable, Subject } from 'rxjs';
import { CounterService } from 'src/counter/counter.service';
import { Response } from 'express';
import { PerplexityService } from 'src/perplexity/perplexity.service';

@Controller('test')
export class TestController {
  private logger: Logger;
  constructor(
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
    private readonly googleService: GoogleService,
    private readonly counterService: CounterService,
    private readonly perplexityService: PerplexityService,
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

  @Post('log-share')
  async shareClicked() {
    try {
      return await this.counterService.logShare();
    } catch (error) {
      this.logger.error((error as Error).message);
      throw new BadRequestException('Something bad happened', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }

  @Get('relevant-blogs')
  async getRelevantBlogs(@Query('text') text: string) {
    const embeddings = await this.llmService.generateEmbeddings(text);
    return await this.llmService.getRelevantBlogs(embeddings);
  }

  @Sse('sse')
  sse(
    @Query() requestDto: CollaborativeLLMRequestDto,
  ): Observable<MessageEvent<DebateHistory>> {
    const subject = new Subject<MessageEvent<DebateHistory>>();
    const providers = [
      // Provider.DeepSeek,
      Provider.OpenAI,
      Provider.Google,
      Provider.Anthropic,
    ];
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
        case Provider.DeepSeek:
          return 'DeepSeek';
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

## Source Citation Requirements
When using web search or referencing internet content:
- **ONLY** provide URLs that are returned from actual web search results
- **NEVER** create, invent, or guess URLs - only use links from verified search results
- Format citations as: [Source Title](URL) or "Quote from source" - [Source Title](URL)
- Include publication date when available from search results
- For statistical claims or data, only cite sources with actual URLs from search results
- When paraphrasing content, only provide source links that were actually retrieved
- Use phrases like "According to [Source](URL)..." only with real URLs from search
- If no web search was performed, cite sources without URLs or indicate general knowledge

## Citation Examples
✅ Good: "Recent studies show a 15% increase in renewable energy adoption" (citing from actual search results with real URL)
✅ Good: According to search results from the World Economic Forum, global trade patterns have shifted significantly.
❌ Poor: "Studies show renewable energy is increasing" (no source)
❌ NEVER: Creating fake URLs like "https://nature.com/articles/example" - only use real URLs from search results

## Intellectual Standards
- Prioritize accuracy over persuasiveness
- Distinguish between facts, interpretations, and speculations
- Identify logical fallacies in arguments (including your own)
- Evaluate the quality and relevance of evidence with proper source attribution
- Consider multiple perspectives on complex issues
- **Verify claims through credible sources and always provide access links**

## Evidence Hierarchy (with citation rules)
1. Peer-reviewed research papers (only if found through actual web search)
2. Government and institutional reports (only with real URLs from search results)
3. Reputable news organizations (only with verified URLs from search)
4. Expert interviews or statements (only with actual source URLs)
5. Opinion pieces (clearly labeled, only with real URLs)
6. General knowledge claims (cite without URLs, clearly indicate as general knowledge)

Remember: Your purpose is to help arrive at nuanced, evidence-based understanding through thoughtful dialogue. Prioritize truth-seeking over persuasion, and ensure all claims are verifiable through provided source links. Transparency in sourcing builds trust and allows others to verify and build upon your arguments.`,
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
        try {
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
                  blog_search_description: z
                    .string()
                    .describe(
                      'A brief descriptive summary of the topic/concept being searched. This will be used to find semantically similar content in my blog collection.',
                    ),
                }),
                execute: async ({ search_query, blog_search_description }) => {
                  // const searchResponse = await this.googleService.search(
                  //   search_query,
                  //   page_number,
                  // );
                  const searchResponse =
                    await this.perplexityService.search(search_query);
                  const embeddings = await this.llmService.generateEmbeddings(
                    blog_search_description,
                  );
                  const relevantBlogs =
                    await this.llmService.getRelevantBlogs(embeddings);
                  const searchHistory: DebateHistory = {
                    type: HistoryType.internetSearch,
                    model: provider,
                    internetSearch: {
                      searchQuery: search_query,
                      searchResponse: [...searchResponse, ...relevantBlogs],
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
          subject.next({
            data: responseHistory,
          } as MessageEvent<DebateHistory>);
        } catch (error) {
          this.logger.error((error as Error).message);
        }
      }
    };

    // Start processing rounds
    const { question, rounds } = requestDto;

    void (async () => {
      await this.counterService.logQuestion(requestDto.question);
      try {
        for (let round = 0; round < rounds; round++) {
          await processRound(round, question);
          // Get final consensus
          const finalMessages: CoreMessage[] = [
            {
              role: 'system',
              content: `You are the final autonomous arbiter in a collaborative debate.

## Your Mission
Review all previous responses and provide a comprehensive, balanced consensus that captures the nuance of the discussion. Your response should flow naturally as part of the existing conversation without any framing statements about your role or task.

## Source Citation Requirements for Final Analysis
When synthesizing the debate and referencing sources mentioned by participants:
- **ALWAYS** include all reference links cited by participants throughout the debate
- Compile and organize all URLs mentioned in previous responses
- Format all citations consistently: [Source Title](URL) or "Key insight" - [Source Title](URL)
- Maintain attribution to show which participant cited which source
- Create a comprehensive reference foundation from the entire discussion

## Synthesis Guidelines
- Identify areas of genuine consensus among participants
- Acknowledge persistent disagreements with nuanced explanation
- Highlight the strongest arguments from each perspective with their source attributions
- Point out logical gaps or unsupported claims
- Suggest productive directions for further inquiry
- Balance competing evidence fairly while preserving all source links

## Reference Compilation
- Consolidate all sources mentioned by different participants
- Organize references by topic or argument thread
- Preserve all URLs provided during the debate
- Group related sources that support similar points
- Maintain clear attribution of sources to original citing participants

## Final Output Standards
- Present a cohesive narrative that honors the complexity revealed in the debate
- Include all reference links from the discussion in your synthesis
- Maintain intellectual humility about remaining uncertainties
- Provide clear access to all sources mentioned by participants
- End with actionable insights based on the compiled evidence

Remember: Your synthesis should compile and organize all sources cited throughout the debate, creating a comprehensive reference foundation while presenting a balanced consensus of the discussion.`,
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
            roundNumber: round,
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

  @Post('convert')
  async convertTextToSpeech(
    @Body() body: TextToSpeechRequest,
    @Res() res: Response,
  ) {
    try {
      const { text, languageCode, voiceName } = body;

      // Validate input
      if (!text || !languageCode || !voiceName) {
        throw new BadRequestException(
          'Missing required fields: text, languageCode, or voiceName',
        );
      }

      if (text.trim().length === 0) {
        throw new BadRequestException('Text cannot be empty');
      }

      // Log the request
      this.logger.log(
        `Converting text to speech: ${text.length} characters, language: ${languageCode}, voice: ${voiceName}`,
      );

      // Convert text to speech (handles chunking internally)
      const audioContent = await this.googleService.textToSpeech(
        text,
        languageCode,
        voiceName,
      );

      // Set appropriate headers for MP3 response
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioContent?.length.toString(),
        'Content-Disposition': 'attachment; filename="speech.mp3"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });

      // Send the binary audio data
      res.status(200).send(audioContent);
    } catch (error) {
      this.logger.error(
        `Text-to-speech conversion failed: ${(error as Error).message}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Text-to-speech conversion failed', {
        cause: new Error(),
        description: (error as Error).message,
      });
    }
  }
}
