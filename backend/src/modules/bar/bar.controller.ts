import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { Admin } from "../../decorators/admin.decorator";
import { Private } from "../../decorators/private.decorator";
import { BarService } from "./bar.service";
import { UpdateBarDto } from "./dto/update-bar.dto";



@Private() @ApiBearerAuth() @Admin()
@Controller('bar')
export class BarController {

    constructor(

        private readonly barService: BarService

    ) { }

    @ApiOperation({ summary: 'Obtiene el estado del bar' })
    @ApiOkResponse({ summary: 'Estado del bar actual' })
    @Get()
    async getBar() {
        return this.barService.getBar(false)
    }

    @ApiOperation({ summary: 'Actualiza el estado del bar' })
    @ApiOkResponse({ description: 'Estado del bar actualizado' })
    @Patch()
    async updateBar(@Body() updateBar: UpdateBarDto) {
        return this.barService.updateBar(updateBar)
    }

}