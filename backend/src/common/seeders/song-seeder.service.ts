import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { SongService } from "../../modules/song/song.service.js";
import { loadSeedsData } from "./seed-loader.util.js";


@Injectable()
export class SongSeederService implements OnModuleInit {
    private readonly logger = new Logger(SongSeederService.name, { timestamp: true })

    constructor(

        private readonly songService: SongService

    ) {}

    async onModuleInit() {
        
        await this.seedSongs()

        this.logger.debug('Song seeder executed')

    }

    async seedSongs() {

        const { songs = [] } = loadSeedsData();

        for (const song of songs) {

            const exist = await this.songService.findOrNull.id(song.id)
            
            if (!exist) await this.songService.create(song)
        }
    }
}