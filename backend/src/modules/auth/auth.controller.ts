import { Body, Controller, Get, NotFoundException, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AuthErrorCode } from "./auth.constants";
import { CreateTableSignDto } from "./dto/table-sign.dto";
import { AuthResCreate, AuthResMe } from "./entities/authRes.entity";
import { CreateUserSignDto } from "./dto/user-sign.dto";
import { GetUser } from "../../decorators/user.decorator";
import type { AnyRequest } from "../../common/types/payload.type";
import { Private } from "../../decorators/private.decorator";


@Controller('auth')
export class AuthController {

    constructor(

        private readonly authService: AuthService

    ) { }


    @ApiOperation({ summary: 'Inicio de sesión como Mesa' })
    @ApiOkResponse({ description: 'Inicio de sesión exitoso', type: AuthResCreate })
    @Post('table')
    async getLoginTable(@Body() createTableSignDto: CreateTableSignDto) {
        return this.authService.signIn.table(createTableSignDto)
    }

    @ApiOperation({ summary: 'Inicio de sesión como Usuario' })
    @ApiOkResponse({ description: 'Inicio de sesión exitoso', type: AuthResCreate })
    @Post('user')
    async getLoginUser(@Body() createUserSignDto: CreateUserSignDto) {
        return this.authService.signIn.user(createUserSignDto)
    }

    @ApiOperation({ summary: 'Identificación del token proporcionado' })
    @ApiOkResponse({ description: 'Entidad autenticada', type: AuthResMe })
    @ApiUnauthorizedResponse({ description: 'Falta autenticación' })
    @Get('me') @Private() @ApiBearerAuth()
    getMe(@GetUser() user: AnyRequest) {
        return user
    }

    @ApiOperation({ summary: 'Fallback de login' })
    @ApiNotFoundResponse({ description: 'Ruta base de inicio de sesión' })
    @Get()
    @Post()
    getLoginRoot() {
        throw new NotFoundException( AuthErrorCode.NOT_FOUND('Se requiere especificar como iniciar', { example: { user: '/user', table: '/table' } }) )
    }

}