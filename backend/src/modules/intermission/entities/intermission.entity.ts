import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity } from "typeorm";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { BaseEntity } from "../../../common/entities/base.entity";

@Entity('intermission')
export class IntermissionEntity extends BaseEntity {

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @Column({ unique: true, type: 'uuid', length: 36 })
    uuid: string;

    @ApiProperty({ description: DESCRIPTION.TITLE, example: EXAMPLE.TITLE })
    @Column({ type: 'varchar' })
    title: string;

    @ApiProperty({ description: DESCRIPTION.DESCRIPTION, example: EXAMPLE.DESCRIPTION })
    @Column({ type: 'text', nullable: true })
    description: string;

    @ApiProperty({ description: DESCRIPTION.IMAGE, example: EXAMPLE.IMAGE })
    @Column({ type: 'varchar' })
    image: string;

    @ApiProperty({ description: DESCRIPTION.URL, example: EXAMPLE.URL })
    @Column({ type: 'varchar' })
    url: string;

    @ApiProperty({ description: DESCRIPTION.ACTIVE, example: EXAMPLE.ACTIVE })
    @Column({ default: true })
    active: boolean;

    @ApiProperty({ description: DESCRIPTION.HOUR, example: EXAMPLE.HOUR })
    @Column({ type: 'time' })
    startTime: string;

    @ApiProperty({ description: DESCRIPTION.HOUR, example: EXAMPLE.HOUR })
    @Column({ type: 'time' })
    endTime: string;

    @ApiProperty({ description: DESCRIPTION.HOUR, example: EXAMPLE.HOUR })
    @Column({ type: 'int', name: 'every_songs', default: null, nullable: true })
    everySongs?: number|null;


}
