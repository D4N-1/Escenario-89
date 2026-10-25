import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "bcrypt";
import { CreateUserDto } from "../../modules/user/dto/user.dto";
import { UserService } from "../../modules/user/user.service";

@Injectable()
export class UserSeederService implements OnModuleInit {

    private logger = new Logger(UserSeederService.name, { timestamp: true })

    constructor(

        private readonly userService: UserService,
        private readonly configService: ConfigService

    ) { }


    async onModuleInit() {
        await this.seedUsers()

        this.logger.debug('User seeder executed')

    }

    async seedUsers() {

        const usersToCreate: CreateUserDto[] = [
            {
                name: this.configService.getOrThrow<string>('ADMIN_NAME'),
                password: this.configService.getOrThrow<string>('ADMIN_PASSWORD')
            }
        ]

        for (const user of usersToCreate) {

            const exist = await this.userService.findOrNull.name(user.name)

            if (!exist) await this.userService.create(user)

            const passwordHash = await hash(user.password, 10)
            if (exist?.passwordHash !== passwordHash) await this.userService.update({ password: user.password })
        }
    }
}