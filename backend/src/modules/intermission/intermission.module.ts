import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntermissionEntity } from './entities/intermission.entity';
import { IntermissionController } from './intermission.controller';
import { IntermissionService } from './intermission.service';
import { QueueSocketModule } from '../queue-socket/queue-socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntermissionEntity]),
    QueueSocketModule,
  ],
  controllers: [IntermissionController],
  providers: [IntermissionService],
  exports: [ IntermissionService ]
})
export class IntermissionModule {}
