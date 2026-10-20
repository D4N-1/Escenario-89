import { IsString, MaxLength, MinLength } from "class-validator";


export class CreateUserDto {

    @IsString()
    @MaxLength(15)
    name: string;

    @IsString()
    @MinLength(8)
    password: string;
    
}