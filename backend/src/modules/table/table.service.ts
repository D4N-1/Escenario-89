import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TableEntity } from "./entities/table.entity.js";
import { Repository } from "typeorm";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { ResAllInterface } from "../../common/interfaces/resAll.interface.js";



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

            if (!table) throw new NotFoundException('No existe ese codigo de mesa')
                return table
        },

        number: async( number: number ): Promise<TableEntity> => {

            const table = await this.tableRepository.findOne({
                where: { number }
            })

            if (!table) throw new NotFoundException('No existe ese numero de mesa')
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


    async findAll(query:GetAllQueryDto): Promise<ResAllInterface> {

        const page = Math.max(1, query?.page);
        const limit = Math.max(10, query?.limit);
        const skip = (query.page - 1) * query.limit;

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
}