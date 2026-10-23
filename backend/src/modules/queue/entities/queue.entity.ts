import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";
import { BaseEntity } from "../../../common/entities/base.entity.js";
import { SongEntity } from "../../song/entities/song.entity.js";
import { TableEntity } from "../../table/entities/table.entity.js";
import { UserEntity } from "../../user/entities/user.entity.js";


export enum SongStatus {
    WAITING = 'WAITING',
    PLAYING = 'PLAYING',
    FINISHED = 'FINISHED',
    CANCELLED = 'CANCELLED'
}

export const QueueRelations = [ 'song', 'table', 'user' ]
@Entity('queue')
export class QueueEntity extends BaseEntity {


    @ApiProperty({ description: DESCRIPTION.POSITION, example: EXAMPLE.POSITION })
    @Column({ type: 'int', nullable: true })
    position: number|null;

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @Column({ unique: true, type: 'uuid', length: 36 })
    uuid: string;

    @ApiProperty({ description: DESCRIPTION.VALUE, example: EXAMPLE.VALUE })
    @Column({ type: 'int', nullable: true })
    value: number|null;

    @ApiProperty({ description: DESCRIPTION.FIXED, example: EXAMPLE.FIXED })
    @Column({ type: 'boolean', default: false })
    fixed: boolean;

    @ApiProperty({ description: DESCRIPTION.STATUS, example: EXAMPLE.STATUS })
    @Column({ type: 'enum', enum: SongStatus, default: SongStatus.WAITING })
    status: SongStatus


    @ApiProperty({ description: 'Entidad mesa', type: () => TableEntity })
    @ManyToOne( () => TableEntity, (table) => table.queues, {
        onUpdate: 'CASCADE',
        nullable: true
    })
    @JoinColumn({ name: 'table' })
    table?: TableEntity|null;

    @ApiProperty({ description: 'Entidad usuario', type: () => UserEntity })
    @ManyToOne( () => UserEntity, (user) => user.queues, {
        onUpdate: 'CASCADE',
        nullable: true
    })
    @JoinColumn({ name: 'user' })
    user?: UserEntity|null;

    @ApiProperty({ description: 'Entidad cancion', type: () => SongEntity })
    @ManyToOne( () => SongEntity, (song) => song.queues, {
        onUpdate: 'CASCADE'
    })
    @JoinColumn({ name: 'song' })
    song: SongEntity;

    
}