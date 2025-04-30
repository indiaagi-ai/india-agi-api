import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from './interfaces';
import {
  CoreMessage,
  LanguageModelV1,
  generateText,
  generateObject,
  ToolSet,
} from 'ai';
import {
  createOpenAI,
  OpenAIProvider,
  OpenAIResponsesProviderOptions,
} from '@ai-sdk/openai';
import { createAnthropic, AnthropicProvider } from '@ai-sdk/anthropic';
import { createXai, XaiProvider } from '@ai-sdk/xai';
import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProvider,
} from '@ai-sdk/google';
import { createGroq, GroqProvider } from '@ai-sdk/groq';
import { z } from 'zod';

@Injectable()
export class LlmService {
  private logger: Logger;
  private openai: OpenAIProvider;
  private anthropic: AnthropicProvider;
  private xai: XaiProvider;
  private google: GoogleGenerativeAIProvider;
  private groq: GroqProvider;

  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(LlmService.name);
    this.openai = createOpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
    });
    this.anthropic = createAnthropic({
      apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
    });
    this.xai = createXai({
      apiKey: this.configService.getOrThrow('XAI_API_KEY'),
    });
    this.google = createGoogleGenerativeAI({
      apiKey: this.configService.getOrThrow('GOOGLEAI_API_KEY'),
    });
    this.groq = createGroq({
      apiKey: this.configService.getOrThrow('GROQ_API_KEY'),
    });
  }

  async getLLMResponse(
    provider: Provider,
    messages: CoreMessage[],
    tools: ToolSet | undefined = undefined,
  ) {
    let model: LanguageModelV1;
    switch (provider) {
      case Provider.OpenAI:
        model = this.openai('gpt-4o-mini');
        break;
      case Provider.Anthropic:
        model = this.anthropic('claude-3-haiku-20240307');
        break;
      case Provider.xAI:
        model = this.xai('grok-3-mini-beta');
        break;
      case Provider.Google:
        model = this.google('gemini-2.0-flash-lite-preview-02-05', {});
        break;
      case Provider.Groq:
        model = this.groq('llama-3.1-8b-instant');
        break;
    }

    try {
      const { text } = await generateText({
        model,
        messages,
        temperature: 0.7,
        tools,
        maxSteps: 5,
        providerOptions: {
          openai: {
            parallelToolCalls: false,
          } satisfies OpenAIResponsesProviderOptions,
        },
      });
      const responseText = text;

      if (responseText.length > 0) {
        this.logger.log(`${provider}: ${responseText}`);
        return responseText;
      } else
        throw new BadRequestException(
          `empty response from LLM: ${provider.toString()}`,
        );
    } catch (ex) {
      this.logger.error('error generating response', (ex as Error).message);
      throw new BadRequestException((ex as Error).message);
    }
  }

  async generateSummary(provider: Provider, content: string) {
    let model: LanguageModelV1;

    switch (provider) {
      case Provider.OpenAI:
        model = this.openai('gpt-4.1-nano');
        break;
      case Provider.Anthropic:
        model = this.anthropic('claude-3-haiku-20240307');
        break;
      case Provider.xAI:
        model = this.xai('grok-3-mini-beta');
        break;
      case Provider.Google:
        model = this.google('gemini-2.0-flash-lite-preview-02-05', {});
        break;
      case Provider.Groq:
        model = this.groq('llama3-8b-8192');
        break;
    }

    try {
      const response = await generateObject({
        model,
        schema: z.object({
          summary: z
            .string()
            .describe('A concise summary of the provided content'),
        }),
        prompt: `Generate a summary of the following content:\n\n ${content}`,
      });

      return response.object.summary;
    } catch (error) {
      this.logger.error('Error generating summary:', error);
      throw new Error('Failed to generate content summary');
    }
  }
}
