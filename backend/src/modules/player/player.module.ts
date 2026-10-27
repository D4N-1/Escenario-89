import { Module } from '@nestjs/common';
import { PlayerController } from './player.controller.js';
import { PlayerService } from './player.service.js';

import { QueueSocketModule } from '../queue-socket/queue-socket.module.js';

@Module({
  imports: [QueueSocketModule],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService]
})
export class PlayerModule {}
