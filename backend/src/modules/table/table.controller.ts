import { Controller, Get, Query } from "@nestjs/common";
import { TableService } from "./table.service.js";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";



@Controller('table')
export class TableController {

    constructor( private readonly tableService: TableService) {}

    @Get()
    getAll(@Query() query: GetAllQueryDto) {
        return this.tableService.findAll(query)
    }
}