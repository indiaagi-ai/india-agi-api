import { Injectable, Logger } from '@nestjs/common';
import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai';
import { Provider } from './interfaces';
import { LanguageModelV1, streamText } from 'ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmService {
  private logger: Logger;
  private openai: OpenAIProvider;
  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(LlmService.name);
    this.openai = createOpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
    });
  }

  async getLLMResponse(provider: Provider, message: string) {
    let model: LanguageModelV1;
    switch (provider) {
      case Provider.OpenAI:
        model = this.openai('gpt-4o-mini');
        break;
      default:
        model = this.openai('gpt-4o-mini');
        break;
    }

    const { textStream } = streamText({
      model,
      messages: [
        {
          role: 'system',
          content: 'you are an helpful AI assistant',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.7,
    });

    const responseText: string[] = [];

    for await (const textPart of textStream) {
      this.logger.log(textPart);
      responseText.push(textPart);
    }

    return responseText.join('');
  }
}
