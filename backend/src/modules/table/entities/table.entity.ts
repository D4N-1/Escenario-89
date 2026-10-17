import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Exclude } from "class-transformer"
import { QueueEntity } from "../../queue/entities/queue.entity.js";

@Entity('table')
export class TableEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    index: number;

    @Column({ unique: true, type: 'varchar', length: 6 })
    code: string;

    @Column({ unique: true, type: 'int' })
    number: number;

    /// Relations

    @OneToMany( () => QueueEntity, (queue) => queue.table)
    queues: QueueEntity[];

}