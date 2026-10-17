import { PartialType } from "@nestjs/mapped-types";
import { QueueEntity } from "../entities/queue.entity.js";


export class UpdateQueueDto extends PartialType(QueueEntity) {}