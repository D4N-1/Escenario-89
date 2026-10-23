import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class PlayIntermissionDto {

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @IsUUID()
    uuid: string;

}