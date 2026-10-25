import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";

export class CreateAudioDto {

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
  
}