import { Controller, Get, NotFoundException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiOperation } from "@nestjs/swagger";
import { AuthErrorCode } from "./auth.constants";


@Controller('auth')
export class AuthController {

    constructor(

        private readonly authService: AuthService

    ) { }


    @ApiOperation({ summary: 'Fallback de login' })
    @Get()
    getLoginRoot() {
        throw new NotFoundException( AuthErrorCode.NOT_FOUND('Se requiere especificar como iniciar', { example: { user: '/user', table: '/table' } }) )
    }

}