import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { CorsConfig } from './common/constants/cors.constants.js';

async function bootstrap() {

  const configService = new ConfigService()

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  const logger = new Logger('Main')


  /// GLOBAL CONFIGS ///

  app.useGlobalPipes( new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true }
  }))

  app.useGlobalInterceptors(new ClassSerializerInterceptor( app.get(Reflector) ) );

  const publicPath = join(process.cwd(), 'uploads')
  console.log(publicPath)
  app.useStaticAssets(publicPath, {
    prefix: '/uploads',
  });
  

  /// ADAPTERS ///

  app.useWebSocketAdapter( new IoAdapter(app) )

  
  /// DOC ///

  const port = configService.get<number>('NEST_PORT') ?? 3000

  const config = new DocumentBuilder()
    .setTitle('Escenario 89 - API')
    .addServer('https://escenario89.danidev.top/api', 'Servidor de produccion')
    .addServer(`http://localhost:${port}`, 'Servidor de desarrollo')
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

  app.enableCors( CorsConfig )

  const hosts = [
    'http://127.0.0.1',
    'http://localhost'
  ]

  await app.listen(port, '0.0.0.0');

  logger.debug(`Servicio ejecutandose en:\n${hosts.map(p => p + ':' + port).join('\n')}`)


}

bootstrap();
