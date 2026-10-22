import { Injectable, NestMiddleware } from "@nestjs/common";


@Injectable()
export class LoggerMiddleware implements NestMiddleware {

    private readonly sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'secret', 'refreshToken', 'accessToken', 'credentials' ];

    use(req: any, res: any, next: (error?: any) => void) {
        
        const startTime = process.hrtime();

        const { method, originalUrl, headers, body, ip } = req;

        const originalSend = res.send;
        let responseBody: any;

        res.send = function (body: any) {

            if (body) {

                try {
                    const stringData = Buffer.isBuffer(body) ? body.toString('utf8') : body;
                    responseBody = typeof stringData === 'string' ? JSON.parse(stringData) : stringData;
                } catch (error) {
                    responseBody = '[No body]';
                }

            }
            return originalSend.apply(res, arguments as any);
        };

        res.on('finish', () => {

            const elapsedTime = process.hrtime(startTime);
            const { statusCode, statusMessage } = res;

            const logMessage = `[${method}] ${originalUrl} - ${statusCode} ${statusMessage} - IP: ${ip} - ${elapsedTime[1] / 1e6}ms`;

            console.log(logMessage);
            
        });

        next();

    }


    private sanitizePayload(payload: any): any {

        if (typeof payload !== 'object' || payload === null) return payload;
        if (Array.isArray(payload)) return payload.map(item => this.sanitizePayload(item));

        const sanitized: any = {};

        for (const key in Object.keys(payload)) {
            if ( this.sensitiveKeys.includes(key.toLocaleLowerCase() ) ) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof payload[key] === 'object' && payload[key] !== null) {
                sanitized[key] = this.sanitizePayload(payload[key]);
            } else sanitized[key] = payload[key];
        }
        return sanitized;
    }
}