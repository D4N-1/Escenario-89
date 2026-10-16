import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service.js';


@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search( @Query() query:any ) {
    console.log(query?.video)
    return this.searchService.search(query?.video)
  }
}
