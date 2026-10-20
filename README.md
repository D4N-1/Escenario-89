# Escenario 89 - Karaoke Bar
Proyecto de página web oficial del Karaoke Bar

## Instalación
1. Descargar el repositorio o clonarlo con
```{powershell}
git clone https://github.com/D4N-1/Escenario-89
```
2. Ubicarse en el repositorio localmente
```{powershell}
cd escenario89
```
3. Instalación de dependencias
```{powershell}
npm i
```

> [!NOTE]
> Abrir dos terminales por separado para levantar las dos aplicaciones.
>
> Siendo estas **frontend** y **backend** respectivamente.

### Frontend

- Build y ejecución
```{powershell}
npm run start -w frontend
```

- Ejecución en modo desarrollador
```{powershell}
npm run watch -w frontend
```

### Backend

- Build y ejecución
```{powershell}
npm run start -w backend
```

- Ejecución en modo desarrollador
```{powershell}
npm run start:dev -w backend
```

> [!TIP]
> **-w** hace referencia a que aplicacion usar su **package.json** sin necesidad de ubicarse fisicamente adentro de la carpeta

