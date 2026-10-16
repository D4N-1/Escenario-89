import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";


export class CreateSongDto {

    @IsString()
    @MaxLength(25)
    id: string;

    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
    
    @IsString()
    image: string;
    
    @IsNumber()
    seconds: number;
    
    @IsString()
    timestamp: string;
    
    @IsNumber()
    views: number;
    
    @IsString()
    author: string;

    @IsNumber()
    count: number;
    
}