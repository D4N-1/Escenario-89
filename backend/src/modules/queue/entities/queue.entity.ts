import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { SongEntity } from "../../song/entities/song.entity.js";
import { TableEntity } from "../../table/entities/table.entity.js";
import { ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";
import { BaseEntity } from "../../../common/entities/base.entity.js";


export enum SongStatus {
    WAITING = 'WAITING',
    PLAYING = 'PLAYING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

export const QueueRelations = [ 'song', 'table' ]
@Entity('queue')
export class QueueEntity extends BaseEntity {


    @ApiProperty({ description: DESCRIPTION.POSITION, example: EXAMPLE.POSITION })
    @Column({ type: 'int', nullable: true })
    position: number;

    @ApiProperty({ description: DESCRIPTION.VALUE, example: EXAMPLE.VALUE })
    @Column({ type: 'int', nullable: true })
    value: number;

    @ApiProperty({ description: DESCRIPTION.FIXED, example: EXAMPLE.FIXED })
    @Column({ type: 'boolean', default: false })
    fixed: boolean;

    @ApiProperty({ description: 'Entidad cancion', type: () => SongEntity })
    @ManyToOne( () => SongEntity, (song) => song.queues, {
        onUpdate: 'CASCADE'
    })
    @JoinColumn({ name: 'song' })
    song: SongEntity;

    @ApiProperty({ description: DESCRIPTION.STATUS, example: EXAMPLE.STATUS })
    @Column({ type: 'enum', enum: SongStatus, default: SongStatus.WAITING })
    status: SongStatus

    @ApiProperty({ description: 'Entidad mesa', type: () => TableEntity })
    @ManyToOne( () => TableEntity, (table) => table.queues, {
        onUpdate: 'CASCADE',
        nullable: true
    })
    @JoinColumn({ name: 'table' })
    table?: TableEntity;

    
}