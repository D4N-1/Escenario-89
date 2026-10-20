import { ApiHideProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer";
import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";


export class BaseEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    @ApiHideProperty()
    index: number;


    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt: Date;
    
    @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
    updatedAt: Date;


}