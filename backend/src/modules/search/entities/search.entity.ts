import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { SongType } from "../../song/entities/song.entity";


export class SearchEntity {

    @ApiProperty({ description: DESCRIPTION.ID, example: EXAMPLE.ID })
    id: string;
    
    @ApiProperty({ description: DESCRIPTION.TITLE, example: EXAMPLE.TITLE })
    title: string;
    
    @ApiProperty({ description: DESCRIPTION.DESCRIPTION, example: EXAMPLE.DESCRIPTION })
    description: string;
    
    @ApiProperty({ description: DESCRIPTION.TYPE, example: EXAMPLE.TYPE })
    type: SongType;
    
    @ApiProperty({ description: DESCRIPTION.IMAGE, example: EXAMPLE.IMAGE })
    image: string;
    
    @ApiProperty({ description: DESCRIPTION.SECONDS, example: EXAMPLE.SECONDS })
    seconds: number;
    
    @ApiProperty({ description: DESCRIPTION.TIMESTAMP, example: EXAMPLE.TIMESTAMP })
    timestamp: string;
    
    @ApiProperty({ description: DESCRIPTION.VIEWS, example: EXAMPLE.VIEWS })
    views: number;
    
    @ApiProperty({ description: DESCRIPTION.URL, example: EXAMPLE.URL })
    url: string;
    
    @ApiProperty({ description: DESCRIPTION.AGO, example: EXAMPLE.AGO })
    ago?: string|null;
    
    @ApiProperty({ description: DESCRIPTION.AUTHOR, example: EXAMPLE.AUTHOR })
    author: string;

}