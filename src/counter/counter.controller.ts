import { Controller, Get } from '@nestjs/common';
import { CounterService } from './counter.service';

@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  @Get('')
  async getLoginStats() {
    return await this.counterService.getLoginStats();
  }
}
