import { IsNumber } from "class-validator";


export class CreateTableDto {

    @IsNumber()
    number: number;
    
}