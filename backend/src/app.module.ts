import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import AuthNGuard from './guards/auth-n.guard.js';
import AuthZGuard from './guards/auth-z.guard.js';
import { LoggerMiddleware } from './middlewares/logger.middleware.js';
import { AudioModule } from './modules/audio/audio.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BarModule } from './modules/bar/bar.module.js';
import { IntermissionModule } from './modules/intermission/intermission.module.js';
import { QueueSocketModule } from './modules/queue-socket/queue-socket.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { SongModule } from './modules/song/song.module.js';
import { TableModule } from './modules/table/table.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    DatabaseModule,

    AuthModule,
    QueueModule,
    QueueSocketModule,
    SearchModule,
    SongModule,
    TableModule,
    UserModule,
    IntermissionModule,
    AudioModule,
    BarModule,

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: Joi.object({
        ADMIN_NAME: Joi.string().required().min(3),
        ADMIN_PASSWORD: Joi.string().required().min(8),
        JWT_SECRET: Joi.string().required().min(4)
      })
    }),

    ScheduleModule.forRoot(),


  ],
  controllers: [ AppController ],
  providers: [
    AppService,

    {
      provide: APP_GUARD,
      useClass: AuthNGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthZGuard
    }
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {

    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  
  }
}
