import { Injectable, Logger } from '@nestjs/common';
import { SearchResponse, SearchRequest, Item } from './interfaces';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { ScraperService } from 'src/scraper/scraper.service';
import { LlmService } from 'src/llm/llm.service';
import { Provider } from 'src/llm/interfaces';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';

@Injectable()
export class GoogleService {
  logger: Logger;
  client: TextToSpeechClient;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly scraperService: ScraperService,
    private readonly llmService: LlmService,
  ) {
    this.logger = new Logger(GoogleService.name);
    this.client = new TextToSpeechClient();
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

  async textToSpeech(text: string, languageCode: string, name: string) {
    // Check if text exceeds 5000 bytes
    const textBytes = Buffer.byteLength(text, 'utf8');

    if (textBytes <= 5000) {
      return this.shortTextToSpeech(text, languageCode, name);
    } else {
      return this.textToSpeechChunked(text, languageCode, name);
    }
  }

  private async shortTextToSpeech(
    text: string,
    languageCode: string,
    name: string,
  ) {
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
      {
        input: { text },
        voice: {
          languageCode,
          name,
        },
        audioConfig: { audioEncoding: 'MP3' },
      };

    const [response] = await this.client.synthesizeSpeech(request);
    return response.audioContent;
  }

  private async textToSpeechChunked(
    text: string,
    languageCode: string,
    name: string,
  ) {
    const chunks = this.splitTextIntoChunks(text, 4500); // Leave some buffer
    const audioChunks: Buffer[] = [];

    for (const chunk of chunks) {
      const audio = await this.shortTextToSpeech(chunk, languageCode, name);
      if (audio) {
        audioChunks.push(Buffer.from(audio as Uint8Array));
      }
    }

    // Concatenate audio chunks (note: this is basic concatenation)
    // For proper audio merging, you'd want to use ffmpeg or similar
    return Buffer.concat(audioChunks);
  }

  private splitTextIntoChunks(text: string, maxBytes: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    // Split by sentences to maintain natural breaks
    const sentences = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      const potentialChunk =
        currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (Buffer.byteLength(potentialChunk, 'utf8') <= maxBytes) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Single sentence is too long, split by words
          const words = sentence.split(' ');
          let wordChunk = '';

          for (const word of words) {
            const potentialWordChunk =
              wordChunk + (wordChunk ? ' ' : '') + word;

            if (Buffer.byteLength(potentialWordChunk, 'utf8') <= maxBytes) {
              wordChunk = potentialWordChunk;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk);
                wordChunk = word;
              } else {
                // Single word is too long, truncate
                chunks.push(word.substring(0, maxBytes));
              }
            }
          }

          if (wordChunk) {
            currentChunk = wordChunk;
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
