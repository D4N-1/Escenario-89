import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { IsNotEmpty, IsString } from "class-validator";


export class CreateTableSignDto {

    @ApiProperty({ description: DESCRIPTION.CODE, example: EXAMPLE.CODE })
    @IsString()
    @IsNotEmpty()
    code: string;

}