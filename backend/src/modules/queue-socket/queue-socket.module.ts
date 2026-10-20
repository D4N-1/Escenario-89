import { Module } from '@nestjs/common';
import { QueueSocketService } from './queue-socket.service';
import { QueueSocketGateway } from './queue-socket.gateway';

@Module({
  providers: [QueueSocketGateway, QueueSocketService],
})
export class QueueSocketModule {}
