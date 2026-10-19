import { Body, Controller, Get, NotFoundException, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { AuthErrorCode } from "./auth.constants";
import { CreateTableSignDto } from "./dto/table-sign.dto";
import { AuthResCreate } from "./entities/authRes.entity";
import { CreateUserSignDto } from "./dto/user-sign.dto";


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

    @ApiOperation({ summary: 'Fallback de login' })
    @ApiNotFoundResponse({ description: 'Ruta base de inicio de sesión' })
    @Get()
    @Post()
    getLoginRoot() {
        throw new NotFoundException( AuthErrorCode.NOT_FOUND('Se requiere especificar como iniciar', { example: { user: '/user', table: '/table' } }) )
    }

}