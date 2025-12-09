import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { AppMiddleware } from './app/app.middleware';
import { HttpModule } from '@nestjs/axios';
import { TestController } from './test/test.controller';
import { LlmModule } from './llm/llm.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleModule } from './google/google.module';
import { OnlineCounterModule } from './online-counter/online-counter.module';
import { CounterModule } from './counter/counter.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubModule } from './github/github.module';
import { PerplexityModule } from './perplexity/perplexity.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow('DB_USERNAME'),
        password: config.getOrThrow('DB_PASSWORD'),
        database: config.getOrThrow('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    HttpModule,
    ScraperModule,
    LlmModule,
    GoogleModule,
    OnlineCounterModule,
    CounterModule,
    GithubModule,
    PerplexityModule,
  ],
  controllers: [TestController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppMiddleware).forRoutes('*');
  }
}
