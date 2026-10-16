import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class AllQueryPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {

        const limit = value.limit ? Number( value.limit ) : 0;
        const page = value.page ? Number( value.page ) : 0;


        if ( isNaN(limit) ) throw new BadRequestException('El limite debe ser un numero')
            else if ( isNaN(page) ) throw new BadRequestException('El paginado debe ser un numero')

        return { ...value, limit, page }
    }
}