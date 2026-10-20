import { randomUUID } from "node:crypto"
import { UserRole } from "../../modules/user/user.constants"

export const EXAMPLE = {

    ID: 'nF1Rh3vdaeQ',
    TITLE: 'Turn to Ashes [OFFICIAL] - Elena Siegman - lyrics - Ashes of the Damned',
    DESCRIPTION: 'callofduty #blackops7 Listen on your fav streaming service now! https://ffm.to/ashesofthedamned ▻Kevin Sherwood: ...',
    IMAGE: 'https://i.ytimg.com/vi/nF1Rh3vdaeQ/hq720.jpg',
    SECONDS: 251,
    TIMESTAMP: '4:11',
    VIEWS: 829362,
    URL: 'https://youtube.com/watch?v=nF1Rh3vdaeQ',
    AGO: '11mo ago',
    AUTHOR: 'Kevin Sherwood and 3 more',
    COUNT: 1,
    NUMBER: 3,
    CODE: 'BGRRX0',
    TYPE: 'SINGLE',
    VALUE: 2,
    POSITION: 6,
    FIXED: false,
    STATUS: 'PLAYING',
    UUID: randomUUID(),
    NAME: 'Juan',
    PASSWORD: 'juan_password',
    MESSAGE: 'Exito',
    ROLE: UserRole,
    ACCESS_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2RlIjoiVkZSUVowIiwibnVtYmVyIjoxLCJpYXQiOjE3OTI0MzIxMDUsImV4cCI6MTc5MjQ0NjUwNX0.kxCWXJcbE0VRyIhh5cIF4z6IuFKCK4oCs1gEc5ACIGE'

}


export const DESCRIPTION = {

    ID: 'Clave única de la entidad',
    TITLE: 'Titulo de la entidad',
    DESCRIPTION: 'Descripcion relacionada con la entidad',
    IMAGE: 'URL o data de la imagen sobre la entidad',
    SECONDS: 'Duración en segundos completos',
    TIMESTAMP: 'Formato de mm:ss de la duración',
    VIEWS: 'Cantidad de vistas',
    URL: 'URL directa de la entidad',
    AGO: 'Fecha corta o estandar de la creación',
    AUTHOR: 'Nombre del autor',
    COUNT: 'Contador interno de la entidad',
    NUMBER: 'Numero',
    CODE: 'Codigo interno',
    TYPE: 'Tipo del video',
    VALUE: 'El valor/perso en la lista',
    POSITION: 'La posicion de la entidad en la lista',
    FIXED: 'Si se fija la posicion actual en la lista (admin)',
    STATUS: 'Estado de la cancion en la lista',
    UUID: 'Indice único publico',
    NAME: 'Nombre',
    PASSWORD: 'Contraseña',
    MESSAGE: 'Mensaje',
    DATA: 'Entidad de respuesta',
    ACCESS_TOKEN: 'Token de acceso',
    ROLE: 'El rol asignado'

}