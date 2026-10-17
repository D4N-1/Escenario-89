import { ApiProperty } from "@nestjs/swagger";
import { GetAllQueryDto } from "../../../common/dto/getAllQuery.dto";
import { QueueRelations } from "../entities/queue.entity";
import { IsOptional, IsString } from "class-validator";


export class GetAllQueueDto extends GetAllQueryDto {

    @ApiProperty({
        description: 'Relaciones extensibles a la lista',
        example: QueueRelations.join(',')
    })
    @IsOptional()
    @IsString()
    include?: string;
}