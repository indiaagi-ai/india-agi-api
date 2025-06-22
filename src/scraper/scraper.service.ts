import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';

interface OlostepOkResponse {
  result: OlostepResult;
}

interface OlostepResult {
  html_content: string;
  markdown_content: string;
}

@Injectable()
export class ScraperService {
  private logger: Logger;
  private nhm: NodeHtmlMarkdown;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.logger = new Logger(ScraperService.name);
    this.nhm = new NodeHtmlMarkdown();
  }

  async getMarkdownContentFromUsingExternalScraper(
    pageURL: string,
  ): Promise<string> {
    const payload = {
      formats: ['markdown'],
      url_to_scrape: pageURL,
    };
    const headers = {
      Authorization: `Bearer ${this.config.getOrThrow('OLOSTEP_API_KEY')}`,
      'Content-Type': 'application/json',
    };

    try {
      const response: AxiosResponse<OlostepOkResponse> =
        await this.httpService.axiosRef.post(
          this.config.getOrThrow('OLOSTEP_ENDPOINT'),
          payload,
          { headers },
        );

      return response.data.result.markdown_content;
    } catch (e) {
      this.logger.error((e as Error).message);
      return '';
    }
  }

  async getHtmlContent(pageURL: string): Promise<string> {
    try {
      this.logger.log(`fetching ${pageURL}`);
      const response: AxiosResponse<string> =
        await this.httpService.axiosRef.get(pageURL, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          },
          timeout: 1000,
        });
      return response.data;
    } catch {
      // Handle errors properly
      this.logger.verbose(`Failed to fetch HTML from ${pageURL}`);
      return '';
    }
  }

  cleanHtmlContent(htmlContent: string) {
    // Load the HTML into cheerio
    const $ = cheerio.load(htmlContent);

    // Remove all <style> tags
    $('style').remove();

    // Remove all <script> tags
    $('script').remove();

    // Remove all link tags with rel="stylesheet"
    $('link[rel="stylesheet"]').remove();

    // Remove inline styles
    $('[style]').removeAttr('style');

    // Remove head
    $('head').remove();

    // Reove anchor tags
    $('a').remove();

    $('path').remove();

    $('symbol').remove();

    $('svg').remove();

    $('button').remove();

    $('img').remove();

    $('figure').remove();

    // Return the cleaned HTML
    return $.html();
  }

  convertHtmlToMarkdown(htmlContent: string) {
    return this.nhm.translate(htmlContent);
  }
}
