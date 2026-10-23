import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../database/database.module.js';
import { IntermissionModule } from '../intermission/intermission.module.js';
import { QueueSocketModule } from '../queue-socket/queue-socket.module.js';
import { SongModule } from '../song/song.module.js';
import { TableModule } from '../table/table.module.js';
import { UserModule } from '../user/user.module.js';
import { QueueEntity } from './entities/queue.entity.js';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueEntity]),

    SongModule, TableModule, DatabaseModule, QueueSocketModule, UserModule, IntermissionModule
  ],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
