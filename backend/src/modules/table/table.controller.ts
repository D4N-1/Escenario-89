import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { TableService } from "./table.service.js";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { AllQueryPipe } from "../../pipes/allQuery.pipe.js";
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { TableErrorCode, TableExceptions, TableOk, TableSummary } from "./table.constants.js";
import { TableEntity } from "./entities/table.entity.js";
import { CodePipe } from "../../pipes/code.pipe.js";



@Controller('table')
export class TableController {

    constructor( private readonly tableService: TableService) {}

    @ApiOperation({ summary: TableSummary.ALL() })
    @ApiOkResponse({ description: TableOk.ALL(), type: [TableEntity] })
    @ApiBadRequestResponse({ description: TableExceptions.BAD_RQUEST(), schema: { example: TableErrorCode.BAD_REQUEST('QUERY') } })
    @Get()
    getAll(@Query(AllQueryPipe) query: GetAllQueryDto) {
        return this.tableService.findAll(query)
    }

    @ApiOperation({ summary: TableSummary.FIND() })
    @ApiOkResponse({ description: TableOk.FIND(), type: TableEntity })
    @ApiBadRequestResponse({ description: TableExceptions.BAD_RQUEST(), schema: { example: TableErrorCode.BAD_REQUEST('PATH') } })
    @ApiNotFoundResponse({ description: TableExceptions.NOT_FOUND(), schema: { example: TableErrorCode.NOT_FOUND() }})
    @Get('/code/:code')
    async getCode(@Param('code', CodePipe) code: string) {
        return this.tableService.findOne.code(code)
    }

    @ApiOperation({ summary: TableSummary.FIND() })
    @ApiOkResponse({ description: TableOk.FIND(), type: TableEntity })
    @ApiBadRequestResponse({ description: TableExceptions.BAD_RQUEST(), schema: { example: TableErrorCode.BAD_REQUEST('PATH') } })
    @ApiNotFoundResponse({ description: TableExceptions.NOT_FOUND(), schema: { example: TableErrorCode.NOT_FOUND() }})
    @Get('/number/:number')
    async getNumber(@Param('number') number: number) {
        return this.tableService.findOne.number(number)
    }


    @ApiOperation({ summary: 'Fallback general de Code' })
    @Get('/code')
    getCodeRoot() {
        throw new BadRequestException({
            message: 'Debes proporcionar un Code de mesa en la ruta',
            example: '/code/ABCDIG'
        });
    }

    @ApiOperation({ summary: 'Fallback general de Number' })
    @Get('/number')
    getNumberRoot() {
        throw new BadRequestException({
            message: 'Debes proporcionar un Number de mesa en la ruta',
            example: '/number/1'
        });
    }
}