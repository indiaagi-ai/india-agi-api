import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log, Question, Share } from './counter.entity';
import { LoginStats } from './interfaces';

@Injectable()
export class CounterService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,

    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,

    @InjectRepository(Share)
    private readonly shareRepository: Repository<Share>,
  ) {}

  // Method to insert a login record
  async logLogin(visitorId: string): Promise<void> {
    await this.logRepository.insert({ visitorId });
  }

  // Method to get login counts
  async getLoginStats(): Promise<{
    today: number;
    yesterday: number;
    total: number;
  }> {
    const result = (await this.logRepository.query(`
        SELECT
          COUNT(DISTINCT visitor_id) FILTER (WHERE login_time::date = CURRENT_DATE AND visitor_id IS NOT NULL) AS today,
          COUNT(DISTINCT visitor_id) FILTER (WHERE login_time::date = CURRENT_DATE - INTERVAL '1 day' AND visitor_id IS NOT NULL) AS yesterday,
          COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS total
        FROM logs
      `)) as Array<LoginStats>; // PG returns strings for counts

    const { today, yesterday, total } = result[0];

    return {
      today: Number(today),
      yesterday: Number(yesterday),
      total: Number(total),
    };
  }

  // Method to insert a question record
  async logQuestion(questionText: string): Promise<void> {
    const question = this.questionRepository.create({ question: questionText });
    await this.questionRepository.save(question);
  }

  // Method to get questions counts
  async getQuestionsStats(): Promise<{
    today: number;
    yesterday: number;
    total: number;
  }> {
    const result = (await this.questionRepository.query(`
        SELECT
          COUNT(*) FILTER (WHERE asked_time::date = CURRENT_DATE) AS today,
          COUNT(*) FILTER (WHERE asked_time::date = CURRENT_DATE - INTERVAL '1 day') AS yesterday,
          COUNT(*) AS total
        FROM questions
      `)) as Array<LoginStats>;

    const { today, yesterday, total } = result[0];

    return {
      today: Number(today),
      yesterday: Number(yesterday),
      total: Number(total),
    };
  }

  async logShare() {
    await this.shareRepository.save({});
  }

  async getShareStats() {
    const result = (await this.shareRepository.query(`
      SELECT
        COUNT(*) FILTER (WHERE shared_time::date = CURRENT_DATE) AS today,
        COUNT(*) FILTER (WHERE shared_time::date = CURRENT_DATE - INTERVAL '1 day') AS yesterday,
        COUNT(*) AS total
      FROM shares
    `)) as Array<LoginStats>;

    const { today, yesterday, total } = result[0];

    return {
      today: Number(today),
      yesterday: Number(yesterday),
      total: Number(total),
    };
  }
}
