import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service.js';


@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search( @Query() query:any ) {
    return this.searchService.search(query?.video)
  }
}
