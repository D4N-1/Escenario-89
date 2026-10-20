import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { IsNotEmpty, IsString, MinLength } from "class-validator";


export class CreateUserSignDto {

    @ApiProperty({ description: DESCRIPTION.NAME, example: EXAMPLE.NAME })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: DESCRIPTION.PASSWORD, example: EXAMPLE.PASSWORD })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;
    
}