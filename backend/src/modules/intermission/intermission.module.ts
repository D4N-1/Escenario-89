import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntermissionEntity } from './entities/intermission.entity';
import { IntermissionController } from './intermission.controller';
import { IntermissionService } from './intermission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntermissionEntity])
  ],
  controllers: [IntermissionController],
  providers: [IntermissionService],
  exports: [ IntermissionService ]
})
export class IntermissionModule {}
