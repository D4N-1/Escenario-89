import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Exclude } from "class-transformer"
import { QueueEntity } from "../../queue/entities/queue.entity.js";
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";

@Entity('table')
export class TableEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    @ApiHideProperty()
    index: number;

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