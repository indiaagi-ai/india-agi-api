import { Injectable, Logger } from '@nestjs/common';
import { SearchResponse, SearchRequest, Item } from './interfaces';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { ScraperService } from 'src/scraper/scraper.service';

@Injectable()
export class GoogleService {
  logger: Logger;
  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly scraperService: ScraperService,
  ) {
    this.logger = new Logger(GoogleService.name);
  }

  async search(searchQuery: string, pageNumber: number): Promise<Item[]> {
    this.logger.verbose(`\nsearching google for: ${searchQuery}`);
    const params: SearchRequest = {
      q: `${searchQuery} filetype:html`,
      key: this.config.getOrThrow('GOOGLE_API_KEY'),
      cx: this.config.getOrThrow('GOOGLE_SEARCH_ENGINE_ID'),
      start: pageNumber * 3 + 1,
    };

    const response: AxiosResponse<SearchResponse> =
      await this.httpService.axiosRef.get(
        this.config.getOrThrow('GOOGLE_BASE_URL'),
        {
          params,
        },
      );

    response.data.items = await Promise.all(
      response.data.items.map(async (item) => {
        try {
          const html = await this.scraperService.getHtmlContent(item.link);
          const cleaned = this.scraperService.cleanHtmlContent(html);
          const markdown = this.scraperService.convertHtmlToMarkdown(cleaned);

          return {
            title: item.pagemap?.metatags?.[0]?.['og:title'] ?? item.title,
            link: item.link,
            snippet:
              item.pagemap?.metatags?.[0]?.['twitter:description'] ??
              item.snippet,
            content: markdown,
          };
        } catch {
          // Fallback content if scraping fails
          return {
            title: item.pagemap?.metatags?.[0]?.['og:title'] ?? item.title,
            link: item.link,
            snippet:
              item.pagemap?.metatags?.[0]?.['twitter:description'] ??
              item.snippet,
            content: '', // or a fallback message like "Unable to fetch content"
          };
        }
      }),
    );

    const googleSearchResponseString: string[] = [];
    googleSearchResponseString.push('Search Results:\n');
    response.data.items.forEach((item) => {
      googleSearchResponseString.push(`${item.title}: ${item.link}\n`);
    });
    this.logger.verbose(googleSearchResponseString.join());
    return response.data.items;
  }
}
