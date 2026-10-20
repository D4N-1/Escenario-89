import { ApiProperty } from "@nestjs/swagger";
import { GetAllQueryDto } from "../../../common/dto/getAllQuery.dto";
import { QueueRelations } from "../entities/queue.entity";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";


export class GetAllQueueDto extends GetAllQueryDto {

    @ApiProperty({
        description: 'Relaciones extensibles a la lista',
        example: QueueRelations.join(',')
    })
    @IsOptional()
    @IsString()
    include?: string;

    @ApiProperty({
        description: 'Traer todas las listas',
        example: true
    })
    @IsOptional()
    @IsBoolean()
    @Type( () => Boolean)
    all: boolean
}