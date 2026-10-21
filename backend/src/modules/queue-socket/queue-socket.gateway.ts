import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer, OnGatewayInit } from '@nestjs/websockets';
import { QueueSocketService } from './queue-socket.service';
import { CorsSocketConfig } from '../../common/constants/cors.constants';
import { Socket, Server } from 'socket.io'
import { QueueErrorCode } from '../queue/queue.constants';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';


@WebSocketGateway(CorsSocketConfig)
export class QueueSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

  constructor(

    private readonly queueSocketService: QueueSocketService,
    private readonly authService: AuthService

  ) { }

  @WebSocketServer()
  server: Server;


  afterInit(server: Server) {

    server.use( async(client: Socket, next) => {

      try {

        console.log(`Client connected: ${client.id}`)
        console.log(client?.handshake)

        const token = client?.handshake?.headers?.cookie ||
          client?.handshake?.auth?.cookie;


        if (!token) return next( new UnauthorizedException( QueueErrorCode.UNAUTHORIZED('No se proporcionó un token de accesso') ) )

        client.data.use = await this.authService.

      } catch (error) {

      }

    })

  }

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client}`)
  }

  handleDisconnect(client: Socket, reason?: string) {
    console.log(`Client disconnected: ${client}`)
  }





}
