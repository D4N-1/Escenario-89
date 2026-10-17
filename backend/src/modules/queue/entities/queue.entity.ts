import { Exclude } from "class-transformer";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { SongEntity } from "../../song/entities/song.entity.js";
import { TableEntity } from "../../table/entities/table.entity.js";


export enum SongStatus {
    WAITING = 'WAITING',
    PLAYING = 'PLAYING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

@Entity('queue')
export class QueueEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    index: number;

    @Column({ type: 'int' })
    value: number;

    @Column({ type: 'int' })
    position: number;

    @Column({ type: 'boolean', default: false })
    fixed: boolean;

    @ManyToOne( () => SongEntity, (song) => song.queues, {
        onUpdate: 'CASCADE'
    })
    song: SongEntity;

    @Column({ type: 'enum', enum: SongStatus, default: SongStatus.WAITING })
    status: SongStatus

    @ManyToOne( () => TableEntity, (table) => table.queues, {
        onUpdate: 'CASCADE'
    })
    table: TableEntity;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;
    
}