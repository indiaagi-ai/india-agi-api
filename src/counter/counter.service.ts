import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './counter.entity';
import { LoginStats } from './interfaces';

@Injectable()
export class CounterService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
  ) {}

  // Method to insert a login record
  async logLogin(): Promise<void> {
    await this.logRepository.insert({});
  }

  // Method to get login counts
  async getLoginStats(): Promise<{
    today: number;
    yesterday: number;
    total: number;
  }> {
    const result = (await this.logRepository.query(`
        SELECT
          COUNT(*) FILTER (WHERE login_time::date = CURRENT_DATE) AS today,
          COUNT(*) FILTER (WHERE login_time::date = CURRENT_DATE - INTERVAL '1 day') AS yesterday,
          COUNT(*) AS total
        FROM logs
      `)) as Array<LoginStats>; // PG returns strings for counts

    const { today, yesterday, total } = result[0];

    return {
      today: Number(today),
      yesterday: Number(yesterday),
      total: Number(total),
    };
  }
}
