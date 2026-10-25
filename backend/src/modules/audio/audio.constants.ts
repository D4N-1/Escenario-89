import ErrorCode from "../../common/constants/error-code.constants.js"
import Exception from "../../common/constants/exception-sw.constants.js"
import Ok from "../../common/constants/ok-sw.constants.js"
import Summary from "../../common/constants/summary-sw.constants.js"

export const single_name = 'Audio'
export const plural_name = 'Audios'

export const AudioSummary = new Summary(single_name, plural_name)
export const AudioOk = new Ok(single_name, plural_name)
export const AudioExceptions = new Exception(single_name)
export const AudioErrorCode = new ErrorCode(single_name)