import { ResCreateInterface } from "../../../common/interfaces/resCreate.interface";
import { SongStatus } from "../entities/queue.entity";

export interface QueueResCreateInterface extends ResCreateInterface {

    position: number;
    status: SongStatus
    
}