export const AllSocketEvents = [
    {
        name: 'general',
        description: 'Evento que se emite para enviar mensajes generales al cliente o pedir guia'
    },
    {
        name: 'queue',
        description: 'Evento que se emite cuando hay una actualización en la cola'
    },
    {
        name: 'intermission',
        description: 'Evento exclusivo de administracion para saber cuando reproducir un anuncio'
    },
    {
        name: 'bar',
        description: 'Evento global que se emite cuando el estado del bar cambia'
    },
    {
        name: 'intermission:scheduled',
        description: 'Evento que notifica cambios en los anuncios programados'
    }
]
