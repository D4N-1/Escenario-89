import { Module } from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueEntity } from './entities/queue.entity.js';
import { SongModule } from '../song/song.module.js';
import { TableModule } from '../table/table.module.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueEntity]),

    SongModule, TableModule, DatabaseModule
  ],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
