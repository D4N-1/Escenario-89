import { ApiProperty } from "@nestjs/swagger";
import { Column, Entity } from "typeorm";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { BaseEntity } from "../../../common/entities/base.entity";
import { BarStatus } from "../enum/bar-status.enum";


@Entity('bar')
export class BarEntity extends BaseEntity {


    @ApiProperty({ description: DESCRIPTION.BAR_STATUS, example: EXAMPLE.BAR_STATUS })
    @Column({ type: 'enum', enum: BarStatus })
    status: BarStatus

    @ApiProperty({ description: DESCRIPTION.HOUR, example: EXAMPLE.HOUR })
    @Column({ name:'close_hour', type: 'time' })
    closeHour: string;

}