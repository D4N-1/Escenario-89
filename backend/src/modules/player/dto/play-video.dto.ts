import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class PlayVideoDto {
  @IsString()
  @IsOptional()
  url?: string;

  @IsNumber()
  @IsOptional()
  startSeconds?: number;

  @IsBoolean()
  @IsOptional()
  forceLaunch?: boolean;

  @IsBoolean()
  @IsOptional()
  startPaused?: boolean;
}
