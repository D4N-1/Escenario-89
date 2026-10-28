import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { TypeRequest } from '../common/enums/typeRequest.enum';
import { JwtToken } from '../common/interfaces/payload.interface';
import { AnyRequest } from '../common/types/payload.type';

@Injectable()
export class ActivityMiddleware implements NestMiddleware {

  private static sessionStore = new Map<string, number>();

  constructor(

    private jwtService: JwtService,
    private configService: ConfigService

) { }

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) throw new UnauthorizedException('Token no proporcionado');

    const token = authHeader.split(' ')[1];


    const payload: AnyRequest & JwtToken = this.jwtService.verify(token, { secret: this.configService.getOrThrow<string>('JWT_SECRET') });

    if (payload.type === TypeRequest.TABLE) return next();

    const user = payload;


    const now = Date.now();
    const inactivityLimit = 4 * 60 * 10_000;
    const lastActivity = ActivityMiddleware.sessionStore.get( user.iat.toString() );


    if (lastActivity && (now - lastActivity > inactivityLimit)) throw new UnauthorizedException('Sesión cerrada por inactividad (más de 4 horas sin peticiones)');

    ActivityMiddleware.sessionStore.set( user.iat.toString() , now);

    next();
  }
}