import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SongEntity } from "./entities/song.entity.js";
import { SongService } from "./song.service.js";
import { SongController } from "./song.controller.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([SongEntity])
    ],
    providers: [ SongService ],
    controllers: [ SongController ],
    exports: [ SongService ]
})
export class SongModule {}