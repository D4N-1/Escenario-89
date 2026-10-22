import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Private } from '../../decorators/private.decorator.js';
import { SearchEntity } from './entities/search.entity.js';
import { SearchErrorCode } from './search.constants.js';
import { SearchService } from './search.service.js';


@Private() @ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @ApiOperation({ summary: 'Realiza la busqueda de una canción' })
  @ApiOkResponse({ description: 'Busqueda con exito', type: [SearchEntity] })
  @ApiBadRequestResponse({ description: 'Es necesario especificar el nombre de la canción', schema: { example: SearchErrorCode.BAD_REQUEST('QUERY') }})
  @Get()
  search( @Query('title') title:string ) {
    return this.searchService.search(title)
  }
  
}
