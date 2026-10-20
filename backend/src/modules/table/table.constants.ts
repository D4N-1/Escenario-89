import ErrorCode from "../../common/constants/error-code.constants.js";
import Exception from "../../common/constants/exception-sw.constants.js";
import Ok from "../../common/constants/ok-sw.constants.js";
import Summary from "../../common/constants/summary-sw.constants.js";

export const single_name = 'Mesa'
export const plural_name = 'Mesas'

export const TableSummary = new Summary(single_name, plural_name)
export const TableOk = new Ok(single_name, plural_name)
export const TableExceptions = new Exception(single_name)
export const TableErrorCode = new ErrorCode(single_name)