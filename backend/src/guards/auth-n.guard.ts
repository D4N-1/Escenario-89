import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { Private } from "../decorators/private.decorator";
import { Public } from "../decorators/public.decorator";
import { AuthErrorCode } from "../modules/auth/auth.constants";
import { AuthService } from "../modules/auth/auth.service";


@Injectable()
export default class AuthNGuard extends AuthGuard('jwt') {

    constructor(

        private readonly reflector: Reflector,
        private readonly authService: AuthService

    ) {
        super()
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        
        const isPublic = this.reflector.getAllAndOverride(Public, [
            context.getHandler(),
            context.getClass()
        ])

        if (isPublic) return true

        const isPrivate = this.reflector.getAllAndOverride(Private, [
            context.getHandler(),
            context.getClass()
        ])

        if (!isPrivate) return true
        
        return await super.canActivate(context) as boolean;

    }


    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
        
        if(err || !user) {
            

            throw new UnauthorizedException( AuthErrorCode.UNAUTHORIZED(info?.message) )
        }

        return user;
    }


}