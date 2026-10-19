import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport"
import { AuthService } from "../modules/auth/auth.service";
import { Observable } from "rxjs";
import { Public } from "../decorators/public.decorator";
import { Private } from "../decorators/private.decorator";


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
            else return false

    }


}