import { Exclude } from "class-transformer";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QueueEntity } from "../../queue/entities/queue.entity.js";

enum SongType {
    SINGLE = 'SINGLE',
    KARAOKE = 'KARAOKE'
}


@Entity('song')
export class SongEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    index: number;

    @Column({ unique: true, type: 'varchar', length: 25 })
    id: string;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'enum', enum: SongType, default: SongType.SINGLE })
    type: SongType.SINGLE;

    @Column({ type: 'varchar' })
    image: string;

    @Column({ type: 'int' })
    seconds: number;

    @Column({ type: 'varchar' })
    timestamp: string;

    @Column({ type: 'int' })
    views: number;

    @Column({ type: 'varchar' })
    url: string;

    @Column({ type: 'varchar' })
    ago: string;

    @Column({ type: 'varchar' })
    author: string;

    @Column({ type: 'int', default: 1 })
    count: number;

    /// Relations

    @OneToMany( () => QueueEntity, (queue) => queue.song)
    queues: QueueEntity[]
}