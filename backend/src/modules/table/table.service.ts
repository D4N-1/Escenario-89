import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { ResAllInterface } from "../../common/interfaces/resAll.interface.js";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface.js";
import { CreateTableDto } from "./dto/create-table.dto.js";
import { TableEntity } from "./entities/table.entity.js";
import { TableErrorCode } from "./table.constants.js";



@Injectable()
export class TableService {

    constructor(

        @InjectRepository(TableEntity)
        private readonly tableRepository: Repository<TableEntity>

    ) {}


    findOne = {

        code: async( code: string ): Promise<TableEntity> => {

            const table = await this.tableRepository.findOne({
                where: { code }
            })

            if (!table) throw new NotFoundException( TableErrorCode.NOT_FOUND('No existe ese codigo de mesa') )
                return table
        },

        number: async( number: number ): Promise<TableEntity> => {

            const table = await this.tableRepository.findOne({
                where: { number }
            })

            if (!table) throw new NotFoundException( TableErrorCode.NOT_FOUND('No existe ese numero de mesa') )
                return table
        }

    }

    findOrNull = {

        code: async( code: string ): Promise<TableEntity|null> => {

            return await this.tableRepository.findOne({
                where: { code }
            })
        },

        number: async( number: number ): Promise<TableEntity|null> => {

            return await this.tableRepository.findOne({
                where: { number }
            })

        }

    }

    async findAll(query?:GetAllQueryDto): Promise<ResAllInterface> {

        const { limit = 10, page = 1 } = query || {};

        const skip = (page - 1) * limit;

        const [ data, total ] = await this.tableRepository.findAndCount({
            skip,
            take: limit,
            order: { index: 'ASC' }
        })

        return {
            data,
            meta: {
                total,
                count: data.length,
                perPage: limit,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            }
        }
        
    }

    generateTableCode(): string {

        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        let result = '';
        for (let i = 0; i < 6; i++) result += characters.charAt( Math.floor(Math.random() * characters.length) );
        
        return result;
    }

    async create(createTableDto: CreateTableDto): Promise<ResCreateInterface> {

        const { number } = createTableDto;

        const newData: Partial<TableEntity> = {  }

        const table = await this.findOrNull.number(number)
        if (table) throw new ConflictException( TableErrorCode.CONFLICT('Ya existe este número de mesa') )

        newData.number = number;
        newData.code = this.generateTableCode()

        const newTable = this.tableRepository.create(newData)
        return {
            message: "La mesa ha sido creada con exito",
            data: await this.tableRepository.save(newTable)
        }
    }
}