import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";
import { ApiHideProperty, ApiProperty } from "@nestjs/swagger";
import { DESCRIPTION, EXAMPLE } from "../../../common/constants/dto.constants";
import { UserRole } from "../user.constants";
import { Exclude } from "class-transformer";



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
    
}