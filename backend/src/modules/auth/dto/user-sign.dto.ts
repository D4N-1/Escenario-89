import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class CreateUserSignDto {

    //@ApiProperty({ description: DESCRIPTION.NAME, example: EXAMPLE.NAME })
    //@IsString()
    //@IsNotEmpty()
    //name: string;

    @ApiProperty({ description: DESCRIPTION.PASSWORD, example: EXAMPLE.PASSWORD })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;
    
}