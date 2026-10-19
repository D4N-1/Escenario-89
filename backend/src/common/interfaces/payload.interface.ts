import { UserRole } from "../../modules/user/entities/user.entity";

export interface UserRequest {

    name: string;
    role: UserRole

}

export interface TableRequest {

    code: string;
    number: number
    
}