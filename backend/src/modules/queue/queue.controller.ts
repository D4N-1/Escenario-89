import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { QueueOk, QueueSummary } from './queue.constants.js';
import { QueueEntity } from './entities/queue.entity.js';
import { AllQueryPipe } from '../../pipes/allQuery.pipe.js';
import { CreateQueueDto } from './dto/create-queue.dto.js';
import { GetAllQueueDto } from './dto/get-queue.dto.js';
import { QueueResCreate } from './entities/queueRes.entity.js';
import { UpdateQueueDto } from './dto/update-queue.dto.js';
import { Private } from '../../decorators/private.decorator.js';
import { Admin } from '../../decorators/admin.decorator.js';
import { GetUser } from '../../decorators/user.decorator.js';
import type { AnyRequest } from '../../common/types/payload.type.js';


@Private() @ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) { }

    @ApiOperation({ summary: QueueSummary.ALL() })
    @ApiOkResponse({ description: QueueOk.ALL(), type: [QueueEntity] })
    @Get()
    async getAll(@Query(AllQueryPipe) query: GetAllQueueDto) {
      return this.queueService.findAll(query)
    }

    @ApiOperation({ summary: QueueSummary.CREATE() })
    @ApiCreatedResponse({ description: QueueOk.CREATE(), type: QueueResCreate })
    @ApiOkResponse({ description: QueueOk.CREATE(), type: QueueResCreate })
    @Post()
    async postOne(@Body() createQueueDto: CreateQueueDto, @GetUser() user: AnyRequest) {
        return this.queueService.create(createQueueDto, user)
    }

    @ApiOperation({ summary: QueueSummary.EDIT() })
    @ApiOkResponse({ summary: QueueOk.EDIT(), type: QueueResCreate })
    @Patch() @Admin()
    async patchOne(@Body() updateQueueDto: UpdateQueueDto) {
      return this.queueService.update(updateQueueDto)
    }

}
