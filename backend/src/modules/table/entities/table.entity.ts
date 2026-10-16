import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import { Exclude } from "class-transformer"

@Entity('table')
export class TableEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    index: number;

    @Column({ unique: true, type: 'varchar', length: 6 })
    code: string;

    @Column({ unique: true, type: 'int' })
    number: number;


}