import * as dotenv from "dotenv"
dotenv.config()

export const CorsConfig = {

  origin: [
    `http://localhost:${process.env.ANGULAR_PORT ?? 105}`,
    `http://127.0.0.1:${process.env.ANGULAR_PORT ?? 105}`,
    'https://escenario89.danidev.top',
    `http://26.198.176.98:${process.env.ANGULAR_PORT ?? 105}`
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'bot-uid'],
  maxAge: 3_600,
  optionsSuccessStatus: 200
}


export const CorsSocketConfig = {

  ...CorsConfig,
  path: '/socket.io'

}