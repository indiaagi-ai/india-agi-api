import { Controller, Get } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('clones')
  async getClones() {
    const result = await this.githubService.getRepoClones(
      'indiaagi-ai',
      'india-agi-api',
    );
    return result.data;
  }

  @Get('traffic-views')
  async getTrafficViews() {
    const result = await this.githubService.getTrafficViews(
      'indiaagi-ai',
      'india-agi-api',
    );
    return result.data;
  }
}
