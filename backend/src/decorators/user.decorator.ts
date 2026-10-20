import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AnyRequest } from "../common/types/payload.type";


export const GetUser = createParamDecorator(
    (data: any, context: ExecutionContext): AnyRequest => {
        const request = context.switchToHttp().getRequest()
        return request.user
    }
)