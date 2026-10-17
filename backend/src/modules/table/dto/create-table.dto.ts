import { ApiProperty } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class CreateTableDto {

    @ApiProperty({ description: DESCRIPTION.NUMBER, example: EXAMPLE.NUMBER })
    @IsNumber()
    number: number;
    
}