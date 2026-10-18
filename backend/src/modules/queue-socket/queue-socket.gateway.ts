import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { QueueSocketService } from './queue-socket.service';
import { CreateQueueSocketDto } from './dto/create-queue-socket.dto';
import { UpdateQueueSocketDto } from './dto/update-queue-socket.dto';

@WebSocketGateway()
export class QueueSocketGateway {
  constructor(private readonly queueSocketService: QueueSocketService) {}

  @SubscribeMessage('createQueueSocket')
  create(@MessageBody() createQueueSocketDto: CreateQueueSocketDto) {
    return this.queueSocketService.create(createQueueSocketDto);
  }

  @SubscribeMessage('findAllQueueSocket')
  findAll() {
    return this.queueSocketService.findAll();
  }

  @SubscribeMessage('findOneQueueSocket')
  findOne(@MessageBody() id: number) {
    return this.queueSocketService.findOne(id);
  }

  @SubscribeMessage('updateQueueSocket')
  update(@MessageBody() updateQueueSocketDto: UpdateQueueSocketDto) {
    return this.queueSocketService.update(updateQueueSocketDto.id, updateQueueSocketDto);
  }

  @SubscribeMessage('removeQueueSocket')
  remove(@MessageBody() id: number) {
    return this.queueSocketService.remove(id);
  }
}
