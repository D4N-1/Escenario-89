export interface Connection {
    message: string,
    status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
}