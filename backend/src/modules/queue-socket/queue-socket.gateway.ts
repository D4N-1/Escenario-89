import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CorsSocketConfig } from '../../common/constants/cors.constants';
import { wait } from '../../common/functions/wait.function';
import { AuthService } from '../auth/auth.service';
import { Events } from './enums/event.enum';
import { Rooms } from './enums/room.enum';
import { General } from './interfaces/general.interface';
import { QueueUpdate } from './interfaces/queue.interface';
import { AllSocketEvents } from './queue-socket.constants';
import { QueueSocketService } from './queue-socket.service';


@WebSocketGateway(CorsSocketConfig)
export class QueueSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

  constructor(

    private readonly queueSocketService: QueueSocketService,
    private readonly authService: AuthService

  ) { }

  @WebSocketServer()
  server: Server;


  afterInit(server: Server) {

    this.queueSocketService.setServer(server);

    server.use( async(client: Socket, next) => {

      try {

        client.data.user = await this.queueSocketService.handshake(client);
        next();

      } catch (error: any) {

        this.queueSocketService.logger.error(`Client disconnected: ${client.id} - Unauthorized`)

        const errorPayload = error.response || error.message ||
          JSON.stringify({
            code: 'UNKNOWN_ERROR',
            message: 'Error de autenticación de socket desconocido'
          }, null, 2)

        next( new Error(errorPayload) )
        
      }

    })

  }

  async handleConnection(client: Socket, ...args: any[]) {

    let request = this.queueSocketService.getSocketUser(client);

    await wait(1_000);
    client.emit(Events.GENERAL, { message: 'Asignando...' } as General );
    await wait(3_000);

    if (request?.type === 'USER') {

      client.join(Rooms.USER_ROLE + request.role)
      client.emit(Events.GENERAL, { message: 'Bienvenido administrador', room: `user:${request.role}`, events: AllSocketEvents } as General );

      const queue = await this.queueSocketService.getQueue();
      client.emit(Events.QUEUE, { message: 'Actualización de lista', data: queue } as QueueUpdate)


    } else if (request?.type === 'TABLE') {

      client.join(Rooms.TABLE_CODE + request.code)
      client.emit(Events.GENERAL, { message: 'Bienvenido a la mesa', room: `table:${request.code}`, events: AllSocketEvents } as General );

      const queue = await this.queueSocketService.getQueueForTable(request.code);
      client.emit(Events.QUEUE, { message: 'Actualización de lista', data: queue } as QueueUpdate)
      

    }

  }

  handleDisconnect(client: Socket, reason?: string) {
    console.log('Client disconnected: ', client.id, client.data.user)
  }


  @SubscribeMessage(Events.GENERAL)
  handleStart(@ConnectedSocket() client: Socket) {

      client.emit(Events.GENERAL, { message: 'Actualización de lista', room: client.rooms, events: AllSocketEvents } as General)


  }

  

}
