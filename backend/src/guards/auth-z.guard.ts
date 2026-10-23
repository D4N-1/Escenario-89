import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Admin } from "../decorators/admin.decorator";
import { UserRequest } from "../common/interfaces/payload.interface";
import { AuthErrorCode } from "../modules/auth/auth.constants";
import { UserRole } from "../modules/user/user.constants";


@Injectable()
export default class AuthZGuard implements CanActivate {

    constructor(

        private reflector: Reflector

    ) { }

    canActivate(context: ExecutionContext): boolean {
        
        const isAdmin = this.reflector.getAllAndOverride(Admin, [
            context.getHandler(),
            context.getClass()
        ])

        if (!isAdmin) return true

        const request = context.switchToHttp().getRequest()
        const user: UserRequest = request.user;

        if (!user.role) throw new BadRequestException( AuthErrorCode.BAD_REQUEST('ANY', 'No tienes un rol asignado para validar tu permiso') )

        if (user.role !== UserRole.ADMIN) throw new ForbiddenException( AuthErrorCode.FORBIDDEN('Necesitar tener permiso de ADMIN para realizar esta petición', { role: UserRole.ADMIN }) )

        return true
    }
}