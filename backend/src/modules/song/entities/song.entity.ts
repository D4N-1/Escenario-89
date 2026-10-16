import { Exclude } from "class-transformer";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


@Entity('song')
export class SongEntity {

    @PrimaryGeneratedColumn()
    @Exclude()
    index: number;

    @Column({ unique: true, type: 'varchar', length: 25 })
    id: string;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'varchar' })
    image: string;

    @Column({ type: 'int' })
    seconds: number;

    @Column({ type: 'varchar' })
    timestamp: string;

    @Column({ type: 'int' })
    views: number;

    @Column({ type: 'varchar' })
    author: string;

    @Column({ type: 'int' })
    count: number;
}