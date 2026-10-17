import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {

  const configService = new ConfigService()

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Main')


  /// GLOBAL CONFIGS ///

  app.useGlobalPipes( new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
  }))


  /// DOC ///

  const config = new DocumentBuilder()
    .setTitle('Escenario 89 - API')
    .addBearerAuth()
    .addCookieAuth()
    .setDescription('Documentacion sobre el uso del backend de la pagina oficial')
    .setVersion('0.5')
    .build()

    const document = SwaggerModule.createDocument(app, config);

    const swaggerOptions = {  };

  app.use(
    '/scalar',
    apiReference({
      content: document,
      theme: 'deepSpace',
      darkMode: true
    })
  );
  SwaggerModule.setup('swagger', app, document, swaggerOptions)

  /// LISTEN ///

  const port = configService.get<number>('NEST_PORT') ?? 3000
  await app.listen(port);

  const hosts = [
    'http://127.0.0.1',
    'http://localhost'
  ]

  logger.debug(`Servicio ejecutandose en:\n${hosts.map(p => p + ':' + port).join('\n')}`)

}

await bootstrap();
