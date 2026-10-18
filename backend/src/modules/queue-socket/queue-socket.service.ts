import { Injectable } from '@nestjs/common';
import { CreateQueueSocketDto } from './dto/create-queue-socket.dto';
import { UpdateQueueSocketDto } from './dto/update-queue-socket.dto';

@Injectable()
export class QueueSocketService {
  create(createQueueSocketDto: CreateQueueSocketDto) {
    return 'This action adds a new queueSocket';
  }

  findAll() {
    return `This action returns all queueSocket`;
  }

  findOne(id: number) {
    return `This action returns a #${id} queueSocket`;
  }

  update(id: number, updateQueueSocketDto: UpdateQueueSocketDto) {
    return `This action updates a #${id} queueSocket`;
  }

  remove(id: number) {
    return `This action removes a #${id} queueSocket`;
  }
}
