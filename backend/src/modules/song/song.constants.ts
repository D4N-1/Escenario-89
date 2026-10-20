import ErrorCode from "../../common/constants/error-code.constants.js"
import Exception from "../../common/constants/exception-sw.constants.js"
import Ok from "../../common/constants/ok-sw.constants.js"
import Summary from "../../common/constants/summary-sw.constants.js"

export const single_name = 'Cancion'
export const plural_name = 'Canciones'

export const SongSummary = new Summary(single_name, plural_name)
export const SongOk = new Ok(single_name, plural_name)
export const SongExceptions = new Exception(single_name)
export const SongErrorCode = new ErrorCode(single_name)