import { UserRole } from "../../modules/user/user.constants";

export interface UserRequest {

    name: string;
    role: UserRole

}

export interface TableRequest {

    code: string;
    number: number
    
}