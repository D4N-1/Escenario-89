import ErrorCode from "../../common/constants/error-code.constants.js";
import Exception from "../../common/constants/exception-sw.constants.js";
import Ok from "../../common/constants/ok-sw.constants.js";
import Summary from "../../common/constants/summary-sw.constants.js";

export const single_name = 'Autenticacion'
export const plural_name = 'Autenticaciones'

export const AuthSummary = new Summary(single_name, plural_name)
export const AuthOk = new Ok(single_name, plural_name)
export const AuthExceptions = new Exception(single_name)
export const AuthErrorCode = new ErrorCode(single_name)