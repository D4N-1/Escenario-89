import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { UserService } from "../../user/user.service";
import { TableService } from "../../table/table.service";
import { ExtractJwt, Strategy } from "passport-jwt"
import { Request } from "express";
import { AnyRequest } from "../../../common/types/payload.type";
import { TypeRequest } from "../../../common/enums/typeRequest.enum";
import { AuthErrorCode } from "../auth.constants";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(

        readonly configService: ConfigService,
        private readonly userService: UserService,
        private readonly tableService: TableService

    ) {
        
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([

                (request: Request) => {
                    return request?.cookies?.['access_token'] ?? null
                },

                ExtractJwt.fromAuthHeaderAsBearerToken()
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
        })

    }

    async validate(payload: AnyRequest) {
        
        console.log(`strategy`)
        
        switch(payload.type) {

            case TypeRequest.TABLE:

                console.log(payload)
                await this.tableService.findOne.number(payload.number)
                return payload

            case TypeRequest.USER:

                console.log(payload)
                await this.userService.findOne.name(payload.name)
                return payload

            default:
                throw new ForbiddenException( AuthErrorCode.FORBIDDEN('El token proporcionado es inválido', { error: 'payload.type es diferente a USER | TABLE' }) )
        }
    }

}