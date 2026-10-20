import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./entities/user.entity";
import { UserService } from "./user.service";
import { UserSeederService } from "../../common/seeders/user-seeder.service";



@Module({
    imports: [
        TypeOrmModule.forFeature([UserEntity])
    ],
    controllers: [],
    providers: [ UserService, UserSeederService ],
    exports: [ UserService ]
})
export class UserModule {}