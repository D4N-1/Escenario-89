import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { UserService } from "../../modules/user/user.service";
import { CreateUserDto } from "../../modules/user/dto/user.dto";

@Injectable()
export class UserSeederService implements OnModuleInit {

    private logger = new Logger(UserSeederService.name, { timestamp: true })

    constructor(

        private readonly userService: UserService

    ) { }


    async onModuleInit() {
        await this.seedUsers()

        this.logger.debug('User seeder executed')

    }

    async seedUsers() {

        const usersToCreate: CreateUserDto[] = [
            {
                name: 'Administrador',
                password: 'escenario98'
            }
        ]

        for (const user of usersToCreate) {

            const exist = await this.userService.findOrNull.name(user.name)

            if (!exist) await this.userService.create(user)
        }
    }
}