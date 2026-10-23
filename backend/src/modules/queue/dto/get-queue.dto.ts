import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { GetAllQueryDto } from "../../../common/dto/getAllQuery.dto";
import { QueueRelations } from "../entities/queue.entity";


export class GetAllQueueDto extends GetAllQueryDto {

    @ApiProperty({
        description: 'Relaciones extensibles a la lista',
        example: QueueRelations.join(',')
    })
    @IsOptional()
    @IsString()
    include?: string|null;

    @ApiProperty({
        description: 'Traer todas las listas',
        example: true
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true' || value === true) return true;
        if (value === 'false' || value === false) return false;
        return value;
    })
    all?: boolean|null
}