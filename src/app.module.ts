import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScraperModule } from './scraper/scraper.module';
import { AppMiddleware } from './app/app.middleware';
import { HttpModule } from '@nestjs/axios';
import { TestController } from './test/test.controller';

@Module({
  imports: [HttpModule, ScraperModule],
  controllers: [AppController, TestController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppMiddleware).forRoutes('*');
  }
}
