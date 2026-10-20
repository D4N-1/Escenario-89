import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport"
import { AuthService } from "../modules/auth/auth.service";
import { Private } from "../decorators/private.decorator";
import { AuthErrorCode } from "../modules/auth/auth.constants";
import { Public } from "../decorators/public.decorator";


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
            
            console.log('ERROR')
            console.log('Error:', err)
            console.log('Info:', info?.message)
            console.log('User:', user)

            throw new UnauthorizedException( AuthErrorCode.UNAUTHORIZED(info?.message) )
        }

        return user;
    }


}