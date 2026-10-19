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

@Module({
  imports: [
    DatabaseModule,

    TableModule,
    SongModule,
    UserModule,
    QueueModule,
    //QueueSocketModule,
    AuthModule,
    SearchModule,

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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
