import { HEADERS } from "../types/headers.type.js";

export const BAD_REQUEST: Record<HEADERS, string> = {

    ANY: 'Petición inválida, no se logró determinar que atributo es incorrecto',
    BODY: 'Petición inválida, revisa el cuerpo JSON (Request Body) de la solicitud',
    PATH: 'Petición inválida, revisa la URL path de tu petición',
    QUERY: 'Petición inválida, revisa los QUERYS (Query Parameters) en la URL',

};

export default class ErrorCode {

    constructor(

        private single_name: string

    ) {}

    BAD_REQUEST(where: HEADERS, text?: string) {
        return { 
            statusCode: 400,
            error: 'Bad Request',
            message: text || BAD_REQUEST[where]
        }
    }

    UNAUTHORIZED(text?: string) {
        return {
            statusCode: 401,
            error: 'Unauthorized',
            message: text || 'Credenciales invalidas, por favor, inicia sesión',
        }
    }

    FORBIDDEN(text?: string) {
        return {
            statusCode: 403,
            error: 'Forbidden',
            message: text || 'No tienes permiso suficiente para acceder a este metodo'
        }
    }

    NOT_FOUND(text?: string, extra?: object) {
        return {
            statusCode: 404,
            error: 'Not Found',
            message: text || `No se encontró ese registro de ${this.single_name}`,
            ...extra
        }
    }

    CONFLICT(text?: string) {
        return {
            statusCode: 409,
            error: 'Conflict',
            message: text || `No se puede crear, ya existe un ${this.single_name} con esos datos`
        }
    }

    SERVICE_UNAVAILABLE(text?: string) {
        return {
            statusCode: 503,
            error: 'Service Unavailable',
            message: text || `Servicio no disponible temporalmente`
        }
    }

}