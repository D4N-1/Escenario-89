import { ApiProperty } from "@nestjs/swagger";
import { QueueResCreateInterface } from "../interface/queue-resCreate.interface";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { QueueEntity, SongStatus } from "./queue.entity";



export class QueueResCreate implements QueueResCreateInterface {

    @ApiProperty({ description: DESCRIPTION.MESSAGE, example: EXAMPLE.MESSAGE })
    message: string;

    @ApiProperty({ description: DESCRIPTION.DATA, type: () => QueueEntity })
    data: QueueEntity;

    @ApiProperty({ description: DESCRIPTION.POSITION, example: EXAMPLE.POSITION })
    position: number;

    @ApiProperty({ description: DESCRIPTION.FIXED, example: EXAMPLE.FIXED })
    fixed: boolean;

    @ApiProperty({ description: DESCRIPTION.STATUS, example: EXAMPLE.STATUS })
    status: SongStatus;
    
}