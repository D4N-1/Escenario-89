import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Length } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class CreateQueueDto {

    @ApiProperty({ description: DESCRIPTION.ID, example: EXAMPLE.ID })
    @IsString()
    @Length(5, 25)
    songId: string;

    @ApiProperty({ description: DESCRIPTION.CODE, example: EXAMPLE.CODE })
    @IsString()
    @IsOptional()
    @Length(6)
    tableCode?: string;

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @IsUUID()
    @IsOptional()
    uuid?: string;

}