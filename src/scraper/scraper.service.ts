import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { NodeHtmlMarkdown } from 'node-html-markdown';

@Injectable()
export class ScraperService {
  private logger: Logger;
  private nhm: NodeHtmlMarkdown;
  constructor(private readonly httpService: HttpService) {
    this.logger = new Logger(ScraperService.name);
    this.nhm = new NodeHtmlMarkdown();
  }

  async getHtmlContent(pageURL: string): Promise<string> {
    try {
      const response: AxiosResponse<string> =
        await this.httpService.axiosRef.get(pageURL, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          },
          timeout: 10000, // 10 seconds timeout
        });
      return response.data;
    } catch {
      // Handle errors properly
      this.logger.error(`Failed to fetch HTML from ${pageURL}`);
      throw new Error(`Failed to fetch HTML`);
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
