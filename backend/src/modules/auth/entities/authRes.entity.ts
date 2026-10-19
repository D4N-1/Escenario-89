import { ApiProperty } from "@nestjs/swagger"
import { AuthResCreateInterface } from "../interfaces/auth-resCreate.interface"
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants"
import { UserEntity } from "../../user/entities/user.entity";

export class AuthResCreate implements AuthResCreateInterface {

    @ApiProperty({ description: DESCRIPTION.MESSAGE, example: EXAMPLE.MESSAGE })
    message: string;

    @ApiProperty({ description: DESCRIPTION.DATA, type: () => UserEntity })
    data: UserEntity;

    @ApiProperty({ description: DESCRIPTION.ACCESS_TOKEN, example: EXAMPLE.ACCESS_TOKEN })
    access_token: string

}