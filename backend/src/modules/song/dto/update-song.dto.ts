import { PartialType } from "@nestjs/mapped-types";
import { CreateSongDto } from "./create-song.dto.js";

export class UpdateSongDto extends PartialType(CreateSongDto) {}