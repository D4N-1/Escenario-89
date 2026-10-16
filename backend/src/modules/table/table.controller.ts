import { Controller, Get, Query } from "@nestjs/common";
import { TableService } from "./table.service.js";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { AllQueryPipe } from "../../pipes/allQuery.pipe.js";



@Controller('table')
export class TableController {

    constructor( private readonly tableService: TableService) {}

    @Get()
    getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
        return this.tableService.findAll(query)
    }
}