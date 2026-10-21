import { Module } from '@nestjs/common';
import { QueueSocketService } from './queue-socket.service';
import { QueueSocketGateway } from './queue-socket.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ AuthModule ],
  providers: [ QueueSocketGateway, QueueSocketService ],
})
export class QueueSocketModule {}
