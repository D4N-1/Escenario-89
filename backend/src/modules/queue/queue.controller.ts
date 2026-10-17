import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { QueueOk, QueueSummary } from './queue.constants.js';
import { QueueEntity } from './entities/queue.entity.js';
import { AllQueryPipe } from '../../pipes/allQuery.pipe.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { GetAllQueueDto } from './dto/get-queue.dto.js';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) { }

    @ApiOperation({ summary: QueueSummary.ALL() })
    @ApiOkResponse({ description: QueueOk.ALL(), type: [QueueEntity] })
    @Get()
    async getAll(@Query(AllQueryPipe) query: GetAllQueueDto) {
      return this.queueService.findAll(query)
    }

    @Post()
    async postOne(@Body() createQueueDto: CreateQueueDto) {
        return this.queueService.create(createQueueDto)
    }

}
