import { PartialType } from '@nestjs/mapped-types';
import { CreateQueueSocketDto } from './create-queue-socket.dto';

export class UpdateQueueSocketDto extends PartialType(CreateQueueSocketDto) {
  id: number;
}
