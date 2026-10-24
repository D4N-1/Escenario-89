import * as dotenv from "dotenv"
dotenv.config()

export const CorsConfig = {

  origin: [
    `http://localhost:${process.env.ANGULAR_PORT ?? 4200}`,
    `http://127.0.0.1:${process.env.ANGULAR_PORT ?? 4200}`,
    'http://escenario89.danidev.top'

  ],
  credentials: true,
  allowedHeaders: [ 'Content-Type', 'Authorization', 'Accept', 'bot-uid' ],
  maxAge: 3_600,
  optionsSuccessStatus: 200
}


export const CorsSocketConfig = {

    ...CorsConfig,
    path: '/socket.io'

}