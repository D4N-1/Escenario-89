import { Column, Entity, OneToMany } from "typeorm"
import { QueueEntity } from "../../queue/entities/queue.entity.js";
import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";
import { BaseEntity } from "../../../common/entities/base.entity.js";

@Entity('table')
export class TableEntity extends BaseEntity {

    @ApiProperty({ description: DESCRIPTION.CODE, example: EXAMPLE.CODE })
    @Column({ unique: true, type: 'varchar', length: 6 })
    code: string;

    @ApiProperty({ description: DESCRIPTION.NUMBER, example: EXAMPLE.NUMBER })
    @Column({ unique: true, type: 'int' })
    number: number;

    /// Relations

    @OneToMany( () => QueueEntity, (queue) => queue.table)
    queues: QueueEntity[];

}