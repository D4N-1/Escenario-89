import ErrorCode from "../../common/constants/error-code.constants.js"
import Exception from "../../common/constants/exception-sw.constants.js"
import Ok from "../../common/constants/ok-sw.constants.js"
import Summary from "../../common/constants/summary-sw.constants.js"

export const single_name = 'Anuncio'
export const plural_name = 'Anuncios'

export const IntermissionSummary = new Summary(single_name, plural_name)
export const IntermissionOk = new Ok(single_name, plural_name)
export const IntermissionExceptions = new Exception(single_name)
export const IntermissionErrorCode = new ErrorCode(single_name)