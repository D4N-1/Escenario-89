import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AudioController } from "./audio.controller";
import { AudioService } from "./audio.service";
import { AudioEntity } from "./entities/audio.entity";


@Module({
    imports: [
        TypeOrmModule.forFeature([AudioEntity])
    ],
    providers: [ AudioService ],
    controllers: [ AudioController ]
})
export class AudioModule { }