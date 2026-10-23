import { Body, Controller, Get, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { GetAllQueryDto } from '../../common/dto/getAllQuery.dto';
import { Admin } from '../../decorators/admin.decorator';
import { Private } from '../../decorators/private.decorator';
import { AllQueryPipe } from '../../pipes/allQuery.pipe';
import { CreateIntermissionDto } from './dto/create-intermission.dto';
import { PlayIntermissionDto } from './dto/play-intermission.dto';
import { UpdateIntermissionDto } from './dto/update-intermission.dto';
import { IntermissionEntity } from './entities/intermission.entity';
import { IntermissionOk, IntermissionSummary } from './intermission.constant';
import { IntermissionService } from './intermission.service';


@Private() @Admin() @ApiBearerAuth()
@Controller('intermission')
export class IntermissionController {
  constructor(private readonly intermissionService: IntermissionService) {}

  @ApiOperation({ summary: IntermissionSummary.ALL() })
  @ApiOkResponse({ description: IntermissionOk.ALL() , type: [IntermissionEntity] })
  @Get()
  async getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
    return this.intermissionService.findAll(query)
  }
    
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/intermissions',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `video-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: IntermissionSummary.CREATE() })
  @ApiCreatedResponse({ description: IntermissionOk.CREATE() })
  @ApiConsumes('multipart/form-data')
  @Post()
  async create(
    @UploadedFile() file: any,
    @Body() createIntermissionDto: CreateIntermissionDto
  ) {

    console.log
    return this.intermissionService.create(createIntermissionDto, file);
  }

  @ApiOperation({ summary: IntermissionSummary.EDIT() })
  @ApiOkResponse({ description: IntermissionOk.EDIT() })
  @ApiNotFoundResponse({ description: 'No existe ese anuncio' })
  @Patch()
  async patchOne(@Body() updateIntermissionDto: UpdateIntermissionDto) {
    return this.intermissionService.update(updateIntermissionDto)
  }

  @ApiOperation({ summary: 'Reproduce un anuncio en la siguiente pausa' })
  @ApiOkResponse({ description: 'Anuncio enlistado en el siguiente espacio' })
  @ApiNotFoundResponse({ description: 'Ese anuncio no existe' })
  @Post('play')
  async playOne(@Body() playIntermission: PlayIntermissionDto) {
    return this.intermissionService.playOne(playIntermission)
  }
}
