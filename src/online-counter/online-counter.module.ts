import { Module } from '@nestjs/common';
import { OnlineCounterGateway } from './online-counter.gateway';

@Module({
  providers: [OnlineCounterGateway],
})
export class OnlineCounterModule {}
