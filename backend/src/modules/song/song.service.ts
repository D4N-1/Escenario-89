import { BadRequestException, ConflictException, GoneException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Repository } from "typeorm";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { ResAllInterface } from "../../common/interfaces/resAll.interface.js";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface.js";
import { ResUpdateInterface } from "../../common/interfaces/resUpdate.interface.js";
import { CreateSongDto } from "./dto/create-song.dto.js";
import { UpdateSongDto } from "./dto/update-song.dto.js";
import { SongEntity, SongType } from "./entities/song.entity.js";
import { SongErrorCode } from "./song.constants.js";

const execFileAsync = promisify(execFile);

@Injectable()
export class SongService {

    private logger = new Logger(SongService.name)

    constructor(

        @InjectRepository(SongEntity)
        private readonly songRepository: Repository<SongEntity>

    ) {}


    findOne = {

        id: async( id: string ): Promise<SongEntity> => {

            const song = await this.songRepository.findOne({
                where: { id }
            })

            if (!song) throw new NotFoundException( SongErrorCode.NOT_FOUND('No existe esa id de cancion') )
                return song
        },

    }

    findOrNull = {

        id: async( id: string ): Promise<SongEntity|null> => {

            return await this.songRepository.findOne({
                where: { id }
            })
        },

    }

    async findAll(query?:GetAllQueryDto): Promise<ResAllInterface> {

        const page = Math.max(1, Number(query?.page) );
        const limit = Math.max(1, Number(query?.limit) );
        const skip = (page - 1) * limit;

        const [ data, total ] = await this.songRepository.findAndCount({
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

    async create(createSongDto: CreateSongDto): Promise<ResCreateInterface> {

        const { id } = createSongDto;

        const newData: Partial<SongEntity> = { ...createSongDto }

        const song = await this.findOrNull.id(id)
        if (song) throw new ConflictException( SongErrorCode.CONFLICT('Ya existe este id de canción') )

        newData.id = id;
        newData.description = createSongDto.description ?? null;
        if (!newData.type && newData.title) {
            const norm = newData.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            newData.type = /(karaoke|kara\b|ktv|instrumental|backing\s*track|\bpista\b)/i.test(norm)
                ? SongType.KARAOKE
                : SongType.SINGLE;
        }

        const newSong = this.songRepository.create(newData)

        return {
            message: "La cancion ha sido creada con exito",
            data: await this.songRepository.save(newSong)
        }
    }

    async update(updateSongDto: UpdateSongDto): Promise<ResUpdateInterface> {
        
        const { id } = updateSongDto;

        if (!id) throw new BadRequestException({
            message: 'Se debe especificar la id de la canción a editar junto a los cambios',
            example: { id: '9kAjZQb_ULE', title: 'All We Are (Instrumental)' }
        })

        const song = await this.findOne.id(id)

        const newData: Partial<SongEntity> = { ...updateSongDto }
        newData.id = id;

        const editSong = this.songRepository.merge(song, newData)

        return {
            message: "La cancion ha sido modificada con exito",
            change: updateSongDto,
            data: await this.songRepository.save(editSong)
        }

    }

    async insertBulk(songs: CreateSongDto[]) {
        if (!songs || songs.length === 0) return;

        try {
            const songEntities = this.songRepository.create(songs);

            // Usamos insert con cláusula de ignorar en caso de conflicto (Ejemplo para Postgres: DO NOTHING)
            await this.songRepository
                .createQueryBuilder()
                .insert()
                .into(SongEntity) // Reemplaza 'Song' por la entidad correspondiente si es necesario
                .values(songEntities)
                .orIgnore() // Esto le dice a la BD: "Si choca el ID/Unique, ignóralo y no hagas nada"
                .execute();

        } catch (error: any) {
            console.error('Error en insertBulk:', error.message);
        }
    }

    async getMostCount(): Promise<ResCreateInterface> {

        const songs = await this.songRepository.find({
            order: { count: 'DESC' },
            take: 10
        })

        return {
            message: 'Las 10 canciones mas buscadas',
            data: songs
        }
    }

    async getUrlStream(id: string): Promise<{ url: string }> {

        this.logger.log(`Extrayendo stream directo para YouTube ID: ${id}...`);

        const ytUrl = `https://www.youtube.com/watch?v=${id}`;

        const args = [
          '--js-runtimes',
          'node',
          '--remote-components',
          'ejs:github',
          '-f',
          '18/22/best[ext=mp4]/best[vcodec!=none][acodec!=none]/best',
          '-g',
          ytUrl,
        ];
    
        const ytDlpBin = process.env.YTDLP_BIN || 'yt-dlp'

        try {

            const { stdout, stderr } = await execFileAsync(ytDlpBin, args, {
                windowsHide: true
            });


            const lines = stdout.trim().split(/\r?\n/).filter((l) => l.startsWith('http'));

            if (
                (stderr && stderr.includes('ERROR') ) ||
                lines.length === 0
            ) {
                this.logger.error(`yt-dlp stderr: ${stderr}`);
                throw new GoneException('No se pudo obtener la url stream')
            }


            const url = lines[0].trim();
            this.logger.log(`Stream extraído con éxito para ${id}`);

            this.update({ id, url })

            return {
                url
            }

        } catch (err: any) {
            this.logger.error(`Error al extraer stream con yt-dlp para ${id}:`, err?.message || err);
            throw new GoneException(`No se pudo obtener el flujo de video para este contenido: ${err?.message || 'Error desconocido'}` );
        }

    }


}
