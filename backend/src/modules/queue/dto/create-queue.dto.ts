import { IsString, Length } from "class-validator";


export class CreateQueueDto {

    @IsString()
    @Length(5, 25)
    songId: string;

    @IsString()
    @Length(6)
    tableCode: string;

}