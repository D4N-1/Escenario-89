import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { SongService } from "./song.service.js";
import { AllQueryPipe } from "../../pipes/allQuery.pipe.js";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { CreateSongDto } from "./dto/create-song.dto.js";


@Controller('song')
export class SongController {

    constructor(

        private readonly songService: SongService

    ) {}

    @Get()
    async getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
        return this.songService.findAll(query)
    }

    @Post()
    async postOne(@Body() createSongDto: CreateSongDto) {
        return this.songService.create(createSongDto)
    }

}