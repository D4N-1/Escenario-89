import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SearchModule } from './modules/search/search.module.js';
import { ConfigModule } from '@nestjs/config';
import { TableModule } from './modules/table/table.module.js';
import { DatabaseModule } from './database/database.module.js';
import { SongModule } from './modules/song/song.module.js';
import { QueueModule } from './modules/queue/queue.module.js';

@Module({
  imports: [
    DatabaseModule,

    TableModule,
    SongModule,
    SearchModule,

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env'
    }),

    QueueModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
