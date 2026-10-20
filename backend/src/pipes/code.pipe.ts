import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";


@Injectable()
export class CodePipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        
        if (!value) throw new BadRequestException('Se requiere el Code de la mesa')
            else if (value.length !== 6) throw new BadRequestException('El Code de la mesa debe ser de 6 digitos')

        return value
    }
}