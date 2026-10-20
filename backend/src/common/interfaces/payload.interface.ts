import { UserRole } from "../../modules/user/user.constants";
import { TypeRequest } from "../enums/typeRequest.enum";

export interface UserRequest {

    type: TypeRequest.USER
    name: string;
    role: UserRole

}

export interface TableRequest {

    type: TypeRequest.TABLE
    code: string;
    number: number
    
}