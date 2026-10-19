import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { UserModule } from "../user/user.module";
import { TableModule } from "../table/table.module";
import { AuthController } from "./auth.controller";


@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                global: true,
                secret: configService.getOrThrow<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.getOrThrow('EXPIRES_IN')
                }
            })
        }),

        UserModule, TableModule
    ],
    providers: [ AuthService ],
    controllers: [ AuthController ]
})
export class AuthModule {

}