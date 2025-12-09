import { Body, Controller, Post } from '@nestjs/common';
import { PerplexityService } from './perplexity.service';
import { GoogleSearchRequest } from './interfaces/google-search-request';

@Controller('perplexity')
export class PerplexityController {
  constructor(private readonly perplexityService: PerplexityService) {}

  @Post('perplexity-search')
  async googleSearch(@Body() { query }: GoogleSearchRequest) {
    return await this.perplexityService.search(query);
  }
}
