import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcrypt";
import { TypeRequest } from "../../common/enums/typeRequest.enum";
import { TableRequest, UserRequest } from "../../common/interfaces/payload.interface";
import { AnyRequest } from "../../common/types/payload.type";
import { TableService } from "../table/table.service";
import { UserService } from "../user/user.service";
import { AuthErrorCode } from "./auth.constants";
import { CreateTableSignDto } from "./dto/table-sign.dto";
import { CreateUserSignDto } from "./dto/user-sign.dto";
import { AuthResCreateInterface } from "./interfaces/auth-resCreate.interface";


@Injectable()
export class AuthService {
    
    constructor(

        private readonly userService: UserService,
        private readonly tableService: TableService,
        private readonly jwtService: JwtService

    ) { }

    signIn = {

        user: async(createUserSignDto: CreateUserSignDto): Promise<AuthResCreateInterface> => {

            const { password } = createUserSignDto;

            const user = ( await this.userService.find() )?.[0]

            const match = await compare(password, user.passwordHash)
            if (!match) throw new UnauthorizedException( AuthErrorCode.UNAUTHORIZED('Contraseña incorrecta') )

            const payload: UserRequest = {
                type: TypeRequest.USER,
                name: user.name,
                role: user.role
            }

            return {
                message: 'Inicio de sesión exitoso',
                data: user,
                access_token: await this.jwtService.signAsync(payload, { expiresIn: '12h' })
            }
        },

        table: async(createTableSignDto: CreateTableSignDto): Promise<AuthResCreateInterface> => {

            const { code } = createTableSignDto

            const table = await this.tableService.findOne.code(code)

            const payload: TableRequest = {
                type: TypeRequest.TABLE,
                code: table.code,
                number: table.number
            }

            return {
                message: 'Identificacion de mesa exitoso',
                data: table,
                access_token: await this.jwtService.signAsync(payload)
            }
        }

    }

    async verifyToken(token: string): Promise<AnyRequest> {

        if ( token.startsWith('Bearer') ) token = token.replace('Bearer ', '').trim();

        const payload: AnyRequest = await this.jwtService.verify(token)

        switch(payload.type) {

            case TypeRequest.TABLE:

                await this.tableService.findOne.number(payload.number)
                return payload

            case TypeRequest.USER:

                await this.userService.findOne.name(payload.name)
                return payload

            default:
                throw new UnauthorizedException( AuthErrorCode.UNAUTHORIZED('El token proporcionado es inválido', { error: 'payload.type es diferente a USER | TABLE' }) )
                
        }
    }

}