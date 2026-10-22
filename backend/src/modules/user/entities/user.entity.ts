import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer";
import { Column, Entity, OneToMany } from "typeorm";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { BaseEntity } from "../../../common/entities/base.entity";
import { QueueEntity } from "../../queue/entities/queue.entity";
import { UserRole } from "../user.constants";



@Entity('user')
export class UserEntity extends BaseEntity {

    @ApiProperty({ description: DESCRIPTION.NAME, example: EXAMPLE.NAME })
    @Column({ type: 'varchar', length: 15, unique: true })
    name: string;

    @ApiHideProperty()
    @Exclude()
    @Column({ type: 'varchar', name: 'password_hash' })
    passwordHash: string;

    @ApiProperty({ description: DESCRIPTION.ROLE, example: DESCRIPTION.ROLE })
    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole


    ////////////////

    @ApiHideProperty()
    @OneToMany( () => QueueEntity, (queue) => queue.user)
    queues: QueueEntity[];
    
}