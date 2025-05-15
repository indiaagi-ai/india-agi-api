import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { ClonesResponse } from './interfaces';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly githubToken: string;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.githubToken = this.config.getOrThrow<string>('GITHUB_TOKEN');
  }

  async getRepoClones(
    owner: string,
    repo: string,
  ): Promise<AxiosResponse<ClonesResponse>> {
    const url = `https://api.github.com/repos/${owner}/${repo}/traffic/clones`;

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const response: AxiosResponse<ClonesResponse> =
        await this.httpService.axiosRef.get(url, { headers });

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch clone data: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getTrafficViews(
    owner: string,
    repo: string,
  ): Promise<AxiosResponse<ClonesResponse>> {
    const url = `https://api.github.com/repos/${owner}/${repo}/traffic/views`;

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
      const response: AxiosResponse<ClonesResponse> =
        await this.httpService.axiosRef.get(url, { headers });

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch clone data: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
