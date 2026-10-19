import { Reflector } from "@nestjs/core";


/**
 * Decorador que indica si el endpoint es de entrada pública (no authN)
 */
export const Public = Reflector.createDecorator<string>()