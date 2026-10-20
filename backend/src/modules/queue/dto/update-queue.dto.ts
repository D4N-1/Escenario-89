import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID } from "class-validator";
import { SongStatus } from "../entities/queue.entity.js";


export class UpdateQueueDto {

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @IsUUID()
    @IsNotEmpty()
    uuid: string;

    @ApiProperty({ description: DESCRIPTION.POSITION, example: EXAMPLE.POSITION })
    @IsNumber()
    @IsOptional()
    position?: number;

    @ApiProperty({ description: DESCRIPTION.FIXED, example: EXAMPLE.FIXED })
    @IsBoolean()
    @IsOptional()
    fixed: boolean;

    @ApiProperty({ description: DESCRIPTION.STATUS, example: EXAMPLE.STATUS })
    @IsEnum(SongStatus)
    @IsOptional()
    status?: SongStatus;

}