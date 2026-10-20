import { Reflector } from "@nestjs/core";

/**
 * Decorador que indica si el endpoint requiere autenticación
 */
export const Private = Reflector.createDecorator<void, boolean>({
    transform: () => true,
});