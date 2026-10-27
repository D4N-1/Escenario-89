import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PlaybackControlDto {
  @IsString()
  @IsNotEmpty()
  action!: 'play' | 'pause' | 'toggle' | 'seek' | 'restart' | 'skip';

  @IsOptional()
  value?: any;
}
