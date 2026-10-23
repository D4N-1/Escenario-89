import { Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { TableRequest, UserRequest } from '../../common/interfaces/payload.interface';
import { AnyRequest } from '../../common/types/payload.type';
import { AuthService } from '../auth/auth.service';
import { IntermissionEntity } from '../intermission/entities/intermission.entity';
import { QueueEntity } from '../queue/entities/queue.entity';
import { UserRole } from '../user/user.constants';
import { Events } from './enums/event.enum';
import { Rooms } from './enums/room.enum';
import { Intermission } from './interfaces/intermission.interface';

@Injectable()
export class QueueSocketService {

  private server: Server;
  private queue: QueueEntity[] = [];

  setServer(server: Server) {
    this.server = server;
  }

  setQueue(queue: QueueEntity[]) {
    this.queue = queue;
  }

  constructor(

    private readonly authService: AuthService,
    
  ) { }

  readonly logger = new Logger(QueueSocketService.name)


  handshake(client: Socket): Promise<AnyRequest> {

    this.logger.debug(`Client connected: ${client.id}`)

    const token = client?.handshake?.headers?.cookie ||
      client?.handshake?.auth?.cookie ||
      client?.handshake?.headers?.authorization ||
      client?.handshake?.auth?.authorization;


    if (!token) throw new WsException( JSON.stringify({
      code: 'UNAUTHORIZED',
      message: 'No se proporcionó un token de accesso'
    }, null, 2) )

    try {

      return this.authService.verifyToken(token)

    } catch (error) {
      this.logger.error(`Client disconnected: ${client.id} - Unauthorized`)
      throw new WsException( JSON.stringify({
        code: 'INVALID_TOKEN',
        message: 'Token inválido'
      }, null, 2) )
    }

  }

  getSocketUser(client: Socket): UserRequest | TableRequest | null {

    switch (client.data.user?.type) {

      case 'USER':
        return client.data.user as UserRequest

      case 'TABLE':
        return client.data.user as TableRequest

      default:
        return null
    }
    
  }

  async updateQueue(Queue: QueueEntity[]) {

    this.setQueue(Queue);

    this.server.to(Rooms.USER_ROLE + UserRole.ADMIN).emit(Events.QUEUE, Queue);

    const rooms = this.server.sockets.adapter.rooms;

    for (const [roomName, roomSockets] of rooms.entries()) {

      if (roomName.startsWith('table:') && roomSockets.size > 0) {

        const tableCode = roomName.split(':')[1];

        const queueTable = Queue.filter(q => q?.table?.code === tableCode || q?.status === 'PLAYING');

        this.server.to(roomName).emit(Events.QUEUE, queueTable);

      }
    }
  }


  async getQueueForTable(tableCode: string): Promise<QueueEntity[]> {

    const queueTable = this.queue.filter(q => q?.table?.code === tableCode || q?.status === 'PLAYING');
    return queueTable;
    
  }

  async getQueue(): Promise<QueueEntity[]> {
    return this.queue
  }

  async updateIntermission(Intermissions: IntermissionEntity[]) {

    this.server.to(Rooms.USER_ROLE + UserRole.ADMIN).emit('intermission', { message: 'Nueva pausa publicitaria', data: Intermissions } as Intermission);

  }



}
