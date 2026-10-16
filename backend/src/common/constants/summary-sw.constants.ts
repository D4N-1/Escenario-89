export default class Summary {

    constructor(

        private single_name: string,
        private plural_name: string

    ) {}

    ALL(): string {
        return `Lista todos los ${this.plural_name}`
    }

    COUNT(): string {
        return `Cuenta la cantidad de entidades de ${this.plural_name}`
    }

    CREATE(): string {
        return `Crea un nuevo ${this.single_name}`
    }

    FIND(): string {
        return `Obtiene un ${this.single_name}`
    }

    EDIT(): string {
        return `Edita un ${this.single_name}`
    }

    DELETE(): string {
        return `Elimina un ${this.single_name}`
    }

    RECOVER(): string {
        return `Recupera un ${this.single_name}`
    }

}

