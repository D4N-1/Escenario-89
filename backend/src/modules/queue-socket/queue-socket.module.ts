import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueSocketGateway } from './queue-socket.gateway';
import { QueueSocketService } from './queue-socket.service';

@Module({
  imports: [ AuthModule ],
  providers: [ QueueSocketGateway, QueueSocketService ],
  exports: [ QueueSocketService ]
})
export class QueueSocketModule {}
