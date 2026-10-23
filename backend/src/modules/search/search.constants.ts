import ErrorCode from "../../common/constants/error-code.constants";
import Exception from "../../common/constants/exception-sw.constants";
import Ok from "../../common/constants/ok-sw.constants";
import Summary from "../../common/constants/summary-sw.constants";

export const single_name = 'Busqueda'
export const plural_name = 'Busquedas'

export const SearchSummary = new Summary(single_name, plural_name);
export const SearchOk = new Ok(single_name, plural_name);
export const SearchExceptions = new Exception(single_name);
export const SearchErrorCode = new ErrorCode(single_name)
