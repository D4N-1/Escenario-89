import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity } from "typeorm";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { BaseEntity } from "../../../common/entities/base.entity";


@Entity('audio')
export class AudioEntity extends BaseEntity {

    @ApiProperty({ description: DESCRIPTION.UUID, example: EXAMPLE.UUID })
    @Column({ unique: true, type: 'uuid', length: 36 })
    uuid: string;

    @ApiProperty({ description: DESCRIPTION.TITLE, example: EXAMPLE.TITLE })
    @Column({ type: 'varchar' })
    title: string;

    @ApiProperty({ description: DESCRIPTION.DESCRIPTION, example: EXAMPLE.DESCRIPTION })
    @Column({ type: 'text', nullable: true })
    description: string;

    @ApiProperty({ description: DESCRIPTION.URL, example: EXAMPLE.URL })
    @Column({ type: 'varchar' })
    url: string;

}