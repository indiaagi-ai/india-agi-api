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
      q: `${searchQuery}`,
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
          // const html = await this.scraperService.getHtmlContent(item.link);
          // const cleaned = this.scraperService.cleanHtmlContent(html);
          // const markdown = this.scraperService.convertHtmlToMarkdown(cleaned);

          const markdown =
            await this.scraperService.getMarkdownContentFromUsingExternalScraper(
              item.link,
            );

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
          Provider.OpenAI,
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

  async textToSpeechChunked(text: string, languageCode: string, name: string) {
    // Extract just the language code (e.g., 'hi' from 'hi-IN')
    const langCode = languageCode.split('-')[0];
    const chunks = this.splitTextIntoChunks(text, 4500, langCode); // Leave some buffer
    const audioChunks: Buffer[] = [];

    this.logger.log(
      `Splitting text into ${chunks.length} chunks for language: ${langCode}`,
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.log(
        `Processing chunk ${i + 1}/${chunks.length} (${Buffer.byteLength(chunk, 'utf8')} bytes)`,
      );

      const audio = await this.shortTextToSpeech(chunk, languageCode, name);
      if (audio) {
        audioChunks.push(Buffer.from(audio as Uint8Array));
      }

      // Add small delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Concatenate audio chunks (note: this is basic concatenation)
    // For proper audio merging, you'd want to use ffmpeg or similar
    return Buffer.concat(audioChunks);
  }

  private splitTextIntoChunks(
    text: string,
    maxBytes: number,
    languageCode?: string,
  ): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    // Get sentences using language-aware splitting
    const sentences = this.splitIntoSentences(text, languageCode);

    for (const sentence of sentences) {
      const potentialChunk =
        currentChunk +
        (currentChunk ? this.getSentenceSeparator(languageCode) : '') +
        sentence;

      if (Buffer.byteLength(potentialChunk, 'utf8') <= maxBytes) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = sentence;
        } else {
          // Single sentence is too long, split by words/phrases
          const subChunks = this.splitLongSentence(
            sentence,
            maxBytes,
            languageCode,
          );
          chunks.push(...subChunks.slice(0, -1));
          currentChunk = subChunks[subChunks.length - 1] || '';
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.filter((chunk) => chunk.trim().length > 0);
  }

  private splitIntoSentences(text: string, languageCode?: string): string[] {
    // Language-specific sentence splitting patterns
    const patterns = {
      // English and European languages
      en: /(?<=[.!?])\s+/,

      // Hindi - Devanagari script
      hi: /(?<=[।॥.!?])\s+/,

      // Bengali - Bengali script
      bn: /(?<=[।॥.!?])\s+/,

      // Telugu - Telugu script
      te: /(?<=[।॥.!?])\s+/,

      // Marathi - Devanagari script
      mr: /(?<=[।॥.!?])\s+/,

      // Tamil - Tamil script
      ta: /(?<=[।॥.!?।])\s+/,

      // Gujarati - Gujarati script
      gu: /(?<=[।॥.!?])\s+/,

      // Kannada - Kannada script
      kn: /(?<=[।॥.!?])\s+/,

      // Malayalam - Malayalam script
      ml: /(?<=[।॥.!?])\s+/,
    };

    const pattern =
      patterns[languageCode as keyof typeof patterns] || patterns.en;
    const sentences = text.split(pattern);

    return sentences.filter((sentence) => sentence.trim().length > 0);
  }

  private getSentenceSeparator(languageCode?: string): string {
    // No space needed for languages that don't use spaces between sentences
    const noSpaceLanguages = ['zh', 'ja'];

    if (noSpaceLanguages.includes(languageCode || '')) {
      return '';
    }

    return ' ';
  }

  private splitLongSentence(
    sentence: string,
    maxBytes: number,
    languageCode?: string,
  ): string[] {
    const chunks: string[] = [];

    // Try splitting by phrases first (commas, semicolons, etc.)
    const phrasePatterns = {
      en: /[,;:]/,
      hi: /[,;:।]/,
      bn: /[,;:।]/,
      te: /[,;:।]/,
      mr: /[,;:।]/,
      ta: /[,;:।]/,
      gu: /[,;:।]/,
      kn: /[,;:।]/,
      ml: /[,;:।]/,
      zh: /[，；：]/,
      ar: /[،؛:]/,
      ja: /[、；：]/,
      ko: /[,;:]/,
    };

    const phrasePattern =
      phrasePatterns[languageCode as keyof typeof phrasePatterns] ||
      phrasePatterns.en;
    const phrases = sentence.split(phrasePattern);

    if (phrases.length > 1) {
      let currentChunk = '';

      for (let i = 0; i < phrases.length; i++) {
        const phrase =
          phrases[i] +
          (i < phrases.length - 1 ? this.getPhraseSeparator(languageCode) : '');
        const potentialChunk = currentChunk + phrase;

        if (Buffer.byteLength(potentialChunk, 'utf8') <= maxBytes) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = phrase;
          } else {
            // Even single phrase is too long, split by words
            chunks.push(...this.splitByWords(phrase, maxBytes, languageCode));
            currentChunk = '';
          }
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }
    } else {
      // No phrases found, split by words
      chunks.push(...this.splitByWords(sentence, maxBytes, languageCode));
    }

    return chunks;
  }

  private getPhraseSeparator(languageCode?: string): string {
    // Different languages use different phrase separators
    const separators = {
      zh: '，',
      ja: '、',
      ar: '،',
    };

    return separators[languageCode as keyof typeof separators] || ',';
  }

  private splitByWords(
    text: string,
    maxBytes: number,
    languageCode?: string,
  ): string[] {
    const chunks: string[] = [];

    // Different word splitting patterns for different languages
    const words = this.splitIntoWords(text, languageCode);
    let currentChunk = '';

    for (const word of words) {
      const separator = this.getWordSeparator(languageCode);
      const potentialChunk =
        currentChunk + (currentChunk ? separator : '') + word;

      if (Buffer.byteLength(potentialChunk, 'utf8') <= maxBytes) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = word;
        } else {
          // Single word/character is too long, force split
          const maxChars = Math.floor(maxBytes / 3); // Conservative UTF-8 estimate
          chunks.push(word.substring(0, maxChars));

          // Handle remaining part recursively if needed
          const remaining = word.substring(maxChars);
          if (remaining) {
            chunks.push(
              ...this.splitByWords(remaining, maxBytes, languageCode),
            );
          }
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitIntoWords(text: string, languageCode?: string): string[] {
    // Languages without spaces between words
    const noSpaceLanguages = ['zh', 'ja'];

    if (noSpaceLanguages.includes(languageCode || '')) {
      // For Chinese/Japanese, split by character or use more sophisticated segmentation
      return text.split('');
    }

    // For space-separated languages
    return text.split(/\s+/).filter((word) => word.length > 0);
  }

  private getWordSeparator(languageCode?: string): string {
    const noSpaceLanguages = ['zh', 'ja'];

    if (noSpaceLanguages.includes(languageCode || '')) {
      return '';
    }

    return ' ';
  }
}
