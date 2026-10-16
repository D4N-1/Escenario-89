# Escenario 89 - Karaoke Bar

Proyecto de página web oficial del Karaoke Bar



## Instalación

Descargar el repositorio o clonarlo con
```{powershell}
git clone https://github.com/D4N-1/Escenario-89
```

Ubicarse en el repositorio localmente
```{powershell}
cd escenario89
```

Instalación de dependencias
```{powershell}
npm i
```

En dos terminales por separado, levantar frontend y backend con
### Frontend

```{powershell}
npm run start -w frontend
```

Despliegue


```{powershell}
npm run watch -w frontend
```

Recarga automatica



Solo vistas (maquetación), sin funcionalidad.

    npm install
    npm start          # http://localhost:4200  → /vistas tiene el índice de todas las pantallas

Estructura: `src/app/{client,admin,pantalla,splash,shared}`. Datos de ejemplo en `src/app/mock-data.ts`.
Colores en `src/styles.css` (variables `--c-*`).
