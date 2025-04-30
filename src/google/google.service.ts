import { Injectable, Logger } from '@nestjs/common';
import { SearchResponse, SearchRequest, Item } from './interfaces';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { ScraperService } from 'src/scraper/scraper.service';
import { LlmService } from 'src/llm/llm.service';
import { Provider } from 'src/llm/interfaces';

@Injectable()
export class GoogleService {
  logger: Logger;
  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
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

    // First, get all HTML content in parallel
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
            markdown: markdown, // Store the markdown for summary generation
          };
        } catch {
          // Fallback content if scraping fails
          return {
            title: item.pagemap?.metatags?.[0]?.['og:title'] ?? item.title,
            link: item.link,
            snippet:
              item.pagemap?.metatags?.[0]?.['twitter:description'] ??
              item.snippet,
            markdown: '', // Empty markdown if scraping fails
          };
        }
      }),
    );

    // Then generate all summaries in parallel
    const summaryPromises = response.data.items.map(async (item) => {
      if (item.markdown && item.markdown.length > 0) {
        this.logger.log(`generating summary for ${item.link}`);
        const summary = this.llmService.generateSummary(
          Provider.xAI,
          item.markdown,
        );
        summary
          .then((summaryRes) => this.logger.log(summaryRes))
          .catch(() => {});
        return summary;
      }
      return '';
    });

    const summaries = await Promise.all(summaryPromises);

    // Finally, add the summaries to the items
    response.data.items = response.data.items.map((item, index) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      content: summaries[index],
    }));

    response.data.items = response.data.items.filter(
      (item) =>
        item.content !== null &&
        item.content !== undefined &&
        item.content.length !== 0,
    );

    const googleSearchResponseString: string[] = [];
    googleSearchResponseString.push('Search Results:\n');
    response.data.items.forEach((item) => {
      googleSearchResponseString.push(`${item.title}: ${item.link}\n`);
    });
    this.logger.verbose(googleSearchResponseString.join('\n'));
    return response.data.items;
  }
}
