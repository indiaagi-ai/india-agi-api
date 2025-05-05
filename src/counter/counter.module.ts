import { Module } from '@nestjs/common';
import { CounterService } from './counter.service';
import { CounterController } from './counter.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log, Question, Share } from './counter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Log, Question, Share])],
  providers: [CounterService],
  controllers: [CounterController],
  exports: [CounterService],
})
export class CounterModule {}
