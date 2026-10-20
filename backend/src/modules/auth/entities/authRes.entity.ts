import { ApiProperty } from "@nestjs/swagger"
import { AuthResCreateInterface } from "../interfaces/auth-resCreate.interface"
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants"
import { UserEntity } from "../../user/entities/user.entity";
import { TableRequest, UserRequest } from "../../../common/interfaces/payload.interface";
import { UserRole } from "../../user/user.constants";
import { TypeRequest } from "../../../common/enums/typeRequest.enum";

export class AuthResCreate implements AuthResCreateInterface {

    @ApiProperty({ description: DESCRIPTION.MESSAGE, example: EXAMPLE.MESSAGE })
    message: string;

    @ApiProperty({ description: DESCRIPTION.DATA, type: () => UserEntity })
    data: UserEntity;

    @ApiProperty({ description: DESCRIPTION.ACCESS_TOKEN, example: EXAMPLE.ACCESS_TOKEN })
    access_token: string

}


export class AuthResMe implements TableRequest {

    @ApiProperty({ description: DESCRIPTION.TYPE, example: EXAMPLE.TYPE })
    type: TypeRequest.TABLE;

    @ApiProperty({ description: DESCRIPTION.CODE, example: EXAMPLE.CODE })
    code: string;

    @ApiProperty({ description: DESCRIPTION.NUMBER, example: EXAMPLE.NUMBER })
    number: number;
    
}