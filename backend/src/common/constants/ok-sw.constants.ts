export default class Ok {

    constructor(

        private single_name: string,
        private plural_name: string

    ) {}

    ALL(): string {
        return `Listado de todos los ${this.plural_name} existentes`
    }

    COUNT(): string {
        return `Cuantos ${this.plural_name} existen en registros`
    }

    CREATE(): string {
        return `${this.single_name} ha sido creado con exito`
    }

    FIND(): string {
        return `${this.single_name} ha sido encontrado con exito`
    }

    EDIT(): string {
        return `${this.single_name} ha sido editado con exito`
    }

    DELETE(): string {
        return `${this.single_name} ha sido eliminado con exito`
    }

    RECOVER(): string {
        return `${this.single_name} ha sido recuperado con exito`
    }


}
