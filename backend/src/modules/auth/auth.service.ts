import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UserService } from "../user/user.service";
import { JwtService } from "@nestjs/jwt";
import { CreateUserSignDto } from "./dto/user-sign.dto";
import { compare } from "bcrypt";
import { AuthErrorCode } from "./auth.constants";
import { AuthResCreateInterface } from "./interfaces/auth-resCreate.interface";
import { TableRequest, UserRequest } from "../../common/interfaces/payload.interface";
import { CreateTableSignDto } from "./dto/table-sign.dto";
import { TableService } from "../table/table.service";
import { TypeRequest } from "../../common/enums/typeRequest.enum";


@Injectable()
export class AuthService {
    
    constructor(

        private readonly userService: UserService,
        private readonly tableService: TableService,
        private readonly jwtService: JwtService

    ) { }

    signIn = {

        user: async(createUserSignDto: CreateUserSignDto): Promise<AuthResCreateInterface> => {

            const { name, password } = createUserSignDto;

            const user = await this.userService.findOne.name(name)

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
                access_token: await this.jwtService.signAsync(payload)
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

}