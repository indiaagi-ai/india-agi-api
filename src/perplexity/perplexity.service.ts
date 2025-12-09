import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Perplexity from '@perplexity-ai/perplexity_ai';

@Injectable()
export class PerplexityService {
  logger: Logger;
  client: Perplexity;

  constructor(private readonly config: ConfigService) {
    this.logger = new Logger(PerplexityService.name);
    this.client = new Perplexity({
      apiKey: this.config.getOrThrow<string>('PERPLEXITY_API_KEY'),
    });
  }

  async search(query: string | string[], domains: string[] | null = null) {
    try {
      this.logger.log(
        `${this.config.getOrThrow<string>('PERPLEXITY_API_KEY')}`,
      );
      this.logger.log(`🚀 searching ${JSON.stringify(query, null, 2)}`);
      const search = await this.client.search.create({
        query,
        max_results: 10,
        max_tokens_per_page: 2048,
        search_domain_filter: domains,
      });
      return search.results;
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.logger.error(e.message);
      } else {
        this.logger.error('An unknown error occurred');
      }

      return [];
    }
  }
}
