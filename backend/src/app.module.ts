import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SearchModule } from './modules/search/search.module.js';
import { ConfigModule } from '@nestjs/config';
import { TableModule } from './modules/table/table.module.js';
import { DatabaseModule } from './database/database.module.js';
import { SongModule } from './modules/song/song.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { UserModule } from './modules/user/user.module.js';
import { QueueSocketModule } from './modules/queue-socket/queue-socket.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import * as Joi from 'joi'
import { APP_GUARD } from '@nestjs/core';
import AuthNGuard from './guards/auth-n.guard.js';
import AuthZGuard from './guards/auth-z.guard.js';

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

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validationSchema: Joi.object({
        ADMIN_NAME: Joi.string().required().min(3),
        ADMIN_PASSWORD: Joi.string().required().min(8),
        JWT_SECRET: Joi.string().required().min(4)
      })
    })

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
export class AppModule {}
