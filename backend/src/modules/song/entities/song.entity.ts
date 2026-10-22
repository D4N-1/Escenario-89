import { Exclude } from "class-transformer";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { QueueEntity } from "../../queue/entities/queue.entity.js";
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants.js";
import { BaseEntity } from "../../../common/entities/base.entity.js";

enum SongType {
    SINGLE = 'SINGLE',
    KARAOKE = 'KARAOKE'
}


@Entity('song')
export class SongEntity extends BaseEntity {

    @ApiProperty({ description: DESCRIPTION.ID, example: EXAMPLE.ID })
    @Column({ unique: true, type: 'varchar', length: 25 })
    id: string;

    @ApiProperty({ description: DESCRIPTION.TITLE, example: EXAMPLE.TITLE })
    @Column({ type: 'varchar' })
    title: string;

    @ApiProperty({ description: DESCRIPTION.DESCRIPTION, example: EXAMPLE.DESCRIPTION, required: false })
    @Column({ type: 'text', nullable: true })
    description?: string | null;

    @ApiProperty({ description: DESCRIPTION.TYPE, example: EXAMPLE.TYPE })
    @Column({ type: 'enum', enum: SongType, default: SongType.SINGLE })
    type: SongType.SINGLE;

    @ApiProperty({ description: DESCRIPTION.IMAGE, example: EXAMPLE.IMAGE })
    @Column({ type: 'varchar' })
    image: string;

    @ApiProperty({ description: DESCRIPTION.SECONDS, example: EXAMPLE.SECONDS })
    @Column({ type: 'int' })
    seconds: number;

    @ApiProperty({ description: DESCRIPTION.TIMESTAMP, example: EXAMPLE.TIMESTAMP })
    @Column({ type: 'varchar' })
    timestamp: string;

    @ApiProperty({ description: DESCRIPTION.VIEWS, example: EXAMPLE.VIEWS })
    @Column({ type: 'int' })
    views: number;

    @ApiProperty({ description: DESCRIPTION.URL, example: EXAMPLE.URL })
    @Column({ type: 'varchar' })
    url: string;

    @ApiProperty({ description: DESCRIPTION.AGO, example: EXAMPLE.AGO })
    @Column({ type: 'varchar', nullable: true })
    ago?: string|null;

    @ApiProperty({ description: DESCRIPTION.AUTHOR, example: EXAMPLE.AUTHOR })
    @Column({ type: 'varchar' })
    author: string;

    @ApiProperty({ description: DESCRIPTION.COUNT, example: EXAMPLE.COUNT })
    @Column({ type: 'int', default: 1 })
    count: number;

    /// Relations

    @OneToMany( () => QueueEntity, (queue) => queue.song)
    queues: QueueEntity[]
}