import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('main');
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('IndiaAGI API docs')
    .setDescription('')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 4000);
  logger.log(`swagger: http://localhost:${process.env.PORT ?? 4000}/docs`);
}

bootstrap()
  .then(() => {})
  .catch(() => {});
