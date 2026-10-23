import { Module } from '@nestjs/common';
import { SongModule } from '../song/song.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [
    SongModule
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
