import { PartialType } from "@nestjs/mapped-types";
import { AudioEntity } from "../entities/audio.entity";


export class UpdateAudioDto extends PartialType(AudioEntity) { }