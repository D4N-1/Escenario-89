import { Column, Entity } from "typeorm";
import { BaseEntity } from "../../../common/entities/base.entity";


export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER'
}

@Entity('user')
export class UserEntity extends BaseEntity {

    @Column({ type: 'varchar', length: 15, unique: true })
    name: string;

    @Column({ type: 'varchar', name: 'password_hash' })
    passwordHash: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole
    
}