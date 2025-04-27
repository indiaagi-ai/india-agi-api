import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { AppMiddleware } from './app/app.middleware';
import { HttpModule } from '@nestjs/axios';
import { TestController } from './test/test.controller';
import { LlmModule } from './llm/llm.module';
import { ConfigModule } from '@nestjs/config';
import { GoogleModule } from './google/google.module';
import { OnlineCounterModule } from './online-counter/online-counter.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    ScraperModule,
    LlmModule,
    GoogleModule,
    OnlineCounterModule,
  ],
  controllers: [TestController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppMiddleware).forRoutes('*');
  }
}
