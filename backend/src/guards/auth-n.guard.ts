import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport"
import { AuthService } from "../modules/auth/auth.service";
import { Public_key } from "../decorators/public.decorator";
import { Private } from "../decorators/private.decorator";
import { AuthErrorCode } from "../modules/auth/auth.constants";


@Injectable()
export default class AuthNGuard extends AuthGuard('jwt') {

    constructor(

        private readonly reflector: Reflector,
        private readonly authService: AuthService

    ) {
        super()
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        
        const isPublic = this.reflector.getAllAndOverride(Public_key, [
            context.getHandler(),
            context.getClass()
        ])

        console.log(`isPublic: ${isPublic}`)

        if (isPublic) return true

        const isPrivate = this.reflector.getAllAndOverride(Private, [
            context.getHandler(),
            context.getClass()
        ])

        console.log(isPrivate)

        if (!isPrivate) return true
        
        return await super.canActivate(context) as boolean;

    }


    handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
        
        if(err || !user) {
            
            console.log('ERROR')
            console.log('Error:', err)
            console.log('Info:', info?.message)
            console.log('User:', user)

            throw new UnauthorizedException( AuthErrorCode.UNAUTHORIZED('Token inválido o expirado') )
        }

        return user;
    }


}