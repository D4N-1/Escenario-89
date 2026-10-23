import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { TypeRequest } from "../../../common/enums/typeRequest.enum";
import { TableRequest } from "../../../common/interfaces/payload.interface";
import { UserEntity } from "../../user/entities/user.entity";
import { AuthResCreateInterface } from "../interfaces/auth-resCreate.interface";

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