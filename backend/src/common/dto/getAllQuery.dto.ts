import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, Min } from "class-validator";

export class GetAllQueryDto {

    @ApiProperty({
        description: 'Limita la cantidad de entidades por página',
        example: 10
    })
    @Type( () => Number)
    @IsOptional()
    @IsNumber()
    @Min(0)
    limit?: number;

    @ApiProperty({
        description: 'Especificar el número de página',
        example: 1
    })
    @Type( () => Number)
    @IsNumber()
    @IsOptional()
    @Min(1)
    page?: number;
}