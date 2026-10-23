import { QueueEntity } from "../../queue/entities/queue.entity";

export interface QueueUpdate {
    message: string,
    data: QueueEntity[]
}