import { Module } from '@nestjs/common';
import { OnlineCounterGateway } from './online-counter.gateway';
import { CounterModule } from 'src/counter/counter.module';

@Module({
  imports: [CounterModule],
  providers: [OnlineCounterGateway],
})
export class OnlineCounterModule {}
