import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from './interfaces';
import { CoreMessage, LanguageModelV1, streamText } from 'ai';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { createAnthropic, AnthropicProvider } from '@ai-sdk/anthropic';
import { createXai, XaiProvider } from '@ai-sdk/xai';

@Injectable()
export class LlmService {
  private logger: Logger;
  private openai: OpenAIProvider;
  private anthropic: AnthropicProvider;
  private xai: XaiProvider;

  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(LlmService.name);
    this.openai = createOpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
    });
    this.anthropic = createAnthropic({
      apiKey: '',
    });
    this.xai = createXai({
      apiKey: '',
    });
  }

  async getLLMResponse(provider: Provider, messages: CoreMessage[]) {
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
      default:
        throw new BadRequestException(
          `please check the provider name (accepted values are ${Provider.OpenAI}, ${Provider.Anthropic}, ${Provider.xAI})`,
        );
    }

    try {
      const { textStream } = streamText({
        model,
        messages: messages,
        temperature: 0.7,
      });

      const responseText: string[] = [];

      for await (const textPart of textStream) {
        this.logger.verbose(textPart);
        responseText.push(textPart);
      }

      if (responseText.join('').length > 0) {
        return responseText.join('');
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
