import { Reflector } from "@nestjs/core";

/**
 * Decorador que indica si el endpoint esta protegido a solo admins
 */
export const Admin = Reflector.createDecorator<void, boolean>({
    transform: () => true
})