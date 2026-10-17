import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SongEntity } from "./entities/song.entity.js";
import { SongService } from "./song.service.js";
import { SongController } from "./song.controller.js";
import { SongSeederService } from "../../common/seeders/song-seeder.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([SongEntity])
    ],
    providers: [ SongService, SongSeederService ],
    controllers: [ SongController ],
    exports: [ SongService ]
})
export class SongModule {}