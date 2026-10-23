import { PartialType } from '@nestjs/swagger';
import { CreateIntermissionDto } from './create-intermission.dto';

export class UpdateIntermissionDto extends PartialType(CreateIntermissionDto) {}