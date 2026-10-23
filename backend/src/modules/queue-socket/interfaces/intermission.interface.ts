import { IntermissionEntity } from "../../intermission/entities/intermission.entity";

export interface Intermission {
    message: string,
    data: IntermissionEntity[]
}