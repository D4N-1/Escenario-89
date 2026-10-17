import ErrorCode from "../../common/constants/error-code.constants.js"
import Exception from "../../common/constants/exception-sw.constants.js"
import Ok from "../../common/constants/ok-sw.constants.js"
import Summary from "../../common/constants/summary-sw.constants.js"

export const single_name = 'Lista'
export const plural_name = 'Listas'

export const QueueSummary = new Summary(single_name, plural_name)
export const QueueOk = new Ok(single_name, plural_name)
export const QueueExceptions = new Exception(single_name)
export const QueueErrorCode = new ErrorCode(single_name)