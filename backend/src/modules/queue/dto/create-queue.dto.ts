import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class CreateQueueDto {

    @ApiProperty({ description: DESCRIPTION.ID, example: EXAMPLE.ID })
    @IsString()
    @Length(5, 25)
    songId: string;

    @ApiProperty({ description: DESCRIPTION.CODE, example: EXAMPLE.CODE })
    @IsString()
    @Length(6)
    tableCode: string;

}