import { Controller, Get } from '@nestjs/common';
import { CounterService } from './counter.service';

@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @Get('visitors')
  async getLoginStats() {
    return await this.counterService.getLoginStats();
  }

  @Get('questions')
  async getQuestionsStats() {
    return await this.counterService.getQuestionsStats();
  }
}
