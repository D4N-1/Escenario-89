import { Body, Controller, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Admin } from '../../decorators/admin.decorator';
import { Private } from '../../decorators/private.decorator';
import { CreateIntermissionDto } from './dto/create-intermission.dto';
import { UpdateIntermissionDto } from './dto/update-intermission.dto';
import { IntermissionService } from './intermission.service';


@Private() @Admin() @ApiBearerAuth()
@Controller('intermission')
export class IntermissionController {
  constructor(private readonly intermissionService: IntermissionService) {}


  @Post()
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
  async create(
    @UploadedFile() file: any,
    @Body() createIntermissionDto: CreateIntermissionDto
  ) {
    return this.intermissionService.create(createIntermissionDto, file)
  }

  @ApiOperation({ summary: 'Edita un anuncio' })
  @ApiOkResponse({ summary: 'Anuncio editado' })
  @Patch()
  async patchOne(@Body() updateIntermissionDto: UpdateIntermissionDto) {
    return this.intermissionService.update(updateIntermissionDto)
  }
}
