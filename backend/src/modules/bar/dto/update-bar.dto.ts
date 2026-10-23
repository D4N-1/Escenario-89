import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsMilitaryTime, IsOptional } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { BarStatus } from "../enum/bar-status.enum";


export class UpdateBarDto {

    @ApiProperty({ description: DESCRIPTION.BAR_STATUS, example: EXAMPLE.BAR_STATUS })
    @IsEnum(BarStatus)
    @IsOptional()
    status: BarStatus|null

    @ApiProperty({ description: DESCRIPTION.HOUR, example: EXAMPLE.HOUR })
    @IsMilitaryTime({ message: 'El formato de hora de cierre debe ser HH:MMM' })
    @IsOptional()
    close?: string|null

}