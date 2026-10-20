export default class Exception {

    constructor(

        private single_name: string

    ) {}

    NOT_FOUND(): string { 
        return `No existe ese registro de ${this.single_name}`
    }
    
    CONFLICT(): string { 
        return `Ya existe ese registro de ${this.single_name}`
    }
    
    BAD_RQUEST(): string { 
        return `Petición inválida, revisa el mensaje del error para obtener mas información`
    }
    
    UNAUTHORIZED(): string { 
        return `No estas autenticado, por favor, inicia sesión`
    }
} 
