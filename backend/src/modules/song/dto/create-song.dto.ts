import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";


export class CreateSongDto {

    @ApiProperty({ description: DESCRIPTION.ID, example: EXAMPLE.ID })
    @IsString()
    @MaxLength(25)
    id: string;

    @ApiProperty({ description: DESCRIPTION.TITLE, example: EXAMPLE.TITLE })
    @IsString()
    title: string;

    @ApiProperty({ description: DESCRIPTION.DESCRIPTION, example: EXAMPLE.DESCRIPTION })
    @IsString()
    @IsOptional()
    description?: string;
    
    @ApiProperty({ description: DESCRIPTION.IMAGE, example: EXAMPLE.IMAGE })
    @IsString()
    image: string;
    
    @ApiProperty({ description: DESCRIPTION.SECONDS, example: EXAMPLE.SECONDS })
    @IsNumber()
    seconds: number;
    
    @ApiProperty({ description: DESCRIPTION.TIMESTAMP, example: EXAMPLE.TIMESTAMP })
    @IsString()
    timestamp: string;
    
    @ApiProperty({ description: DESCRIPTION.VIEWS, example: EXAMPLE.VIEWS })
    @IsNumber()
    views: number;

    @ApiProperty({ description: DESCRIPTION.URL, example: EXAMPLE.URL })
    @IsString()
    url: string;

    @ApiProperty({ description: DESCRIPTION.AGO, example: EXAMPLE.AGO })
    @IsString()
    ago: string;
    
    @ApiProperty({ description: DESCRIPTION.AUTHOR, example: EXAMPLE.AUTHOR })
    @IsString()
    author: string;

    @ApiProperty({ description: DESCRIPTION.COUNT, example: EXAMPLE.COUNT })
    @IsNumber()
    @IsOptional()
    count?: number;
    
}