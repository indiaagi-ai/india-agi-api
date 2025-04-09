import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from './interfaces';
import { CoreMessage, LanguageModelV1, generateText, ToolSet } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { createAnthropic, AnthropicProvider } from '@ai-sdk/anthropic';
import { createXai, XaiProvider } from '@ai-sdk/xai';
import {
  createGoogleGenerativeAI,
  GoogleGenerativeAIProvider,
} from '@ai-sdk/google';

@Injectable()
export class LlmService {
  private logger: Logger;
  private openai: OpenAIProvider;
  private anthropic: AnthropicProvider;
  private xai: XaiProvider;
  private google: GoogleGenerativeAIProvider;

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
        model = this.anthropic('claude-3-7-sonnet-20250219');
        break;
      case Provider.xAI:
        model = this.xai('grok-2-1212');
        break;
      case Provider.Google:
        model = this.google('gemini-1.5-flash');
        break;
      default:
        throw new BadRequestException(
          `please check the provider name (accepted values are ${Provider.OpenAI}, ${Provider.Anthropic}, ${Provider.xAI}, ${Provider.Google})`,
        );
    }

    try {
      const response = await generateText({
        model,
        messages,
        temperature: 0.7,
        tools,
        maxSteps: 5,
      });

      const responseText = response.text;

      if (responseText.length > 0) {
        return responseText;
      } else
        throw new BadRequestException(
          `error generating response for provider: ${provider.toString()}`,
        );
    } catch (ex) {
      this.logger.error('error generating response', (ex as Error).message);
      throw new BadRequestException((ex as Error).message);
    }
  }
}
