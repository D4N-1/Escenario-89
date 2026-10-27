import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { Private } from "../../decorators/private.decorator.js";
import { AllQueryPipe } from "../../pipes/allQuery.pipe.js";
import { CreateSongDto } from "./dto/create-song.dto.js";
import { SongEntity } from "./entities/song.entity.js";
import { SongOk, SongSummary } from "./song.constants.js";
import { SongService } from "./song.service.js";


@Private() @ApiBearerAuth()
@Controller('song')
export class SongController {

    constructor(

        private readonly songService: SongService

    ) {}


    @ApiOperation({ summary: SongSummary.ALL() })
    @ApiOkResponse({ description: SongOk.ALL(), type: [SongEntity] })
    @Get()
    async getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
        return this.songService.findAll(query)
    }

    @Post()
    async postOne(@Body() createSongDto: CreateSongDto) {
        return this.songService.create(createSongDto)
    }

    @Get('popular')
    async getPopular() {
        return this.songService.getMostCount()
    }

    @Post('stream')
    async getUrlStream(@Body('id') id: string) {
        return this.songService.getUrlStream(id)
    }

}