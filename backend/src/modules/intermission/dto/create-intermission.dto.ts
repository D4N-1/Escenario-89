import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsMilitaryTime, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";

export class CreateIntermissionDto {

  @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
  @IsUUID()
  @IsOptional()
  uuid?: string;
      
  @ApiProperty({ description: 'Título del anuncio o intermedio', example: 'Anuncio Principal Noche' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descripción detallada', example: 'Publicidad de la casa de bebidas' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Estado activo del intermedio', example: true, default: true })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  active?: boolean;

  @ApiProperty({ description: 'Hora de inicio en formato HH:mm', example: '22:00' })
  @IsMilitaryTime({ message: 'El formato de hora de inicio del anuncio debe ser HH:mm' })
  startTime: string;

  @ApiProperty({ description: 'Hora de cierre en formato HH:mm', example: '03:00' })
  @IsMilitaryTime({ message: 'El formato de hora de fin del anuncio debe ser HH:mm' })
  endTime: string;

  @ApiProperty({ description: 'Cada cuántas canciones se debe disparar', example: 5, default: null })
  @IsInt()
  @Min(1, { message: 'Debe reproducirse al menos cada 1 canción' })
  @IsOptional()
  @Type(() => Number)
  everySongs?: number|null;
  

}