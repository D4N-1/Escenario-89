import ErrorCode from "../../common/constants/error-code.constants.js";
import Exception from "../../common/constants/exception-sw.constants.js";
import Ok from "../../common/constants/ok-sw.constants.js";
import Summary from "../../common/constants/summary-sw.constants.js";

export const single_name = 'Usuario'
export const plural_name = 'Usuarios'

export const UserSummary = new Summary(single_name, plural_name)
export const UserOk = new Ok(single_name, plural_name)
export const UserExceptions = new Exception(single_name)
export const UserErrorCode = new ErrorCode(single_name)

export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER'
}