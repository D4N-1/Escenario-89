import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { hash } from "bcrypt";
import { Repository } from "typeorm";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface";
import { CreateUserDto } from "./dto/user.dto";
import { UserEntity } from "./entities/user.entity";
import { UserErrorCode } from "./user.constants";



@Injectable()
export class UserService {

    constructor(

        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>

    ) { }


    findOne = {

        name: async(name: string): Promise<UserEntity> => {

            const user = await this.userRepository.findOne({
                where: { name }
            })

            if (!user) throw new NotFoundException( UserErrorCode.NOT_FOUND('No existe ese usuario') )
                return user
        }

    }

    findOrNull = {

        name: async(name: string): Promise<UserEntity|null> => {

            return await this.userRepository.findOne({
                where: { name }
            })

        }
    }

    async create(createUserDto: CreateUserDto): Promise<ResCreateInterface> {

        const { password, name } = createUserDto

        const newData: Partial<UserEntity> = {  }

        newData.passwordHash = await hash(password, 10)

        const exist = await this.findOrNull.name(name)
        if (exist) throw new ConflictException( UserErrorCode.CONFLICT('Ese usuario ya existe') )

        newData.name = name;

        const newUser = this.userRepository.create(newData)

        return {
            message: 'Usuario creado con exito',
            data: await this.userRepository.save(newUser)
        }
    }

    async find() {

        return this.userRepository.find()
    }

}