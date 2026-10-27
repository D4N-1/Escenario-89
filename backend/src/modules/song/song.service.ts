import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as yt from "yt-search";
import { GetAllQueryDto } from "../../common/dto/getAllQuery.dto.js";
import { ResAllInterface } from "../../common/interfaces/resAll.interface.js";
import { ResCreateInterface } from "../../common/interfaces/resCreate.interface.js";
import { ResUpdateInterface } from "../../common/interfaces/resUpdate.interface.js";
import { CreateSongDto } from "./dto/create-song.dto.js";
import { UpdateSongDto } from "./dto/update-song.dto.js";
import { SongEntity, SongType } from "./entities/song.entity.js";
import { SongErrorCode } from "./song.constants.js";


@Injectable()
export class SongService {

    constructor(

        @InjectRepository(SongEntity)
        private readonly songRepository: Repository<SongEntity>

    ) {}


    findOne = {

        id: async( id: string ): Promise<SongEntity> => {

            let song = await this.songRepository.findOne({
                where: { id }
            })

            if (!song) {
                song = await this.findOrCreateByVideoId(id);
            }

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

    async findOrCreateByVideoId(id: string): Promise<SongEntity | null> {
        if (!id) return null;
        try {
            const existing = await this.songRepository.findOne({ where: { id } });
            if (existing) return existing;

            const res: any = await yt.search({ videoId: id });
            if (!res || !res.title) return null;

            const seconds = Number(res.seconds ?? res.duration?.seconds) || 0;
            const timestamp = res.timestamp || res.duration?.timestamp || '0:00';
            const author = typeof res.author === 'object' && res.author?.name ? res.author.name : (typeof res.author === 'string' ? res.author : 'Desconocido');
            const norm = String(res.title || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const type = /(karaoke|kara\b|ktv|instrumental|backing\s*track|\bpista\b)/i.test(norm) ? SongType.KARAOKE : SongType.SINGLE;

            const newSong = this.songRepository.create({
                id,
                title: String(res.title || 'Sin título').slice(0, 500),
                description: res.description ? String(res.description) : null,
                type,
                image: (res.thumbnail || res.image || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`).slice(0, 500),
                seconds,
                timestamp,
                views: Math.max(0, Math.round(Number(res.views) || 0)),
                url: `https://cdpn.io/pen/debug/oNPzxKo?v=${id}`,
                ago: res.ago || null,
                author: String(author).slice(0, 255),
                count: 0,
            });

            return await this.songRepository.save(newSong);
        } catch (error: any) {
            console.error(`Error al buscar/crear canción por videoId (${id}):`, error.message);
            return null;
        }
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

        const song = await this.findOrNull.id(id)
        if (song) return {
            message: "La cancion ya existe",
            data: song
        };

        const newData: Partial<SongEntity> = {
            ...createSongDto,
            id,
            title: String(createSongDto.title || 'Sin título').slice(0, 500),
            author: String(createSongDto.author || 'Desconocido').slice(0, 255),
            image: String(createSongDto.image || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`).slice(0, 500),
            url: String(createSongDto.url || `https://cdpn.io/pen/debug/oNPzxKo?v=${id}`).slice(0, 500),
            seconds: Math.max(0, Math.round(Number(createSongDto.seconds) || 0)),
            timestamp: createSongDto.timestamp || '0:00',
            views: Math.max(0, Math.round(Number(createSongDto.views) || 0)),
            description: createSongDto.description ?? null,
        }

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

        // Deduplicate songs by id and sanitize
        const uniqueMap = new Map<string, Partial<SongEntity>>();
        for (const s of songs) {
            if (s && s.id && !uniqueMap.has(s.id)) {
                uniqueMap.set(s.id, {
                    id: s.id,
                    title: String(s.title || 'Sin título').slice(0, 500),
                    author: String(s.author || 'Desconocido').slice(0, 255),
                    description: s.description ?? null,
                    image: String(s.image || `https://i.ytimg.com/vi/${s.id}/mqdefault.jpg`).slice(0, 500),
                    url: String(s.url || `https://cdpn.io/pen/debug/oNPzxKo?v=${s.id}`).slice(0, 500),
                    seconds: Math.max(0, Math.round(Number(s.seconds) || 0)),
                    timestamp: s.timestamp || '0:00',
                    views: Math.max(0, Math.round(Number(s.views) || 0)),
                    type: s.type || SongType.SINGLE,
                    ago: s.ago || null,
                });
            }
        }

        const uniqueSongs = Array.from(uniqueMap.values());
        if (uniqueSongs.length === 0) return;

        try {
            const songEntities = this.songRepository.create(uniqueSongs);

            await this.songRepository.upsert(songEntities, {
                conflictPaths: ['id'],
                skipUpdateIfNoValuesChanged: true,
            });
        } catch (error: any) {
            console.warn('Upsert en lote falló, guardando individualmente:', error.message);
            for (const songData of uniqueSongs) {
                try {
                    const existing = await this.songRepository.findOne({ where: { id: songData.id } });
                    if (!existing) {
                        const entity = this.songRepository.create(songData);
                        await this.songRepository.save(entity);
                    }
                } catch (err: any) {
                    console.error(`Error guardando canción individual ${songData.id}:`, err.message);
                }
            }
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

}