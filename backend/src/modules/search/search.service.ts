import { BadRequestException, Injectable } from '@nestjs/common';
import * as yt from "yt-search";
import { SongType } from '../song/entities/song.entity';
import { SongService } from '../song/song.service';
import { SearchEntity } from './entities/search.entity';
import { SearchErrorCode } from './search.constants';


@Injectable()
export class SearchService {

  constructor(

    private readonly songService: SongService
    
  ) { }

  async search(query: string|undefined): Promise<{ message: string, data: SearchEntity[] }> {

    if (!query) throw new BadRequestException( SearchErrorCode.BAD_REQUEST('QUERY') )

    const results = await yt.search(query)

    let search = (results?.all ?? []).filter( (p) => p.type === 'video' )

    let songs: SearchEntity[] = search.map( (s) => {
      const videoId = s.videoId || (s as any).id || '';
      const seconds = Number(s.seconds ?? (s as any).duration?.seconds) || 0;
      const timestamp = s.timestamp || (s as any).duration?.timestamp || '0:00';
      const authorName = typeof s.author === 'object' && s.author?.name ? s.author.name : (typeof s.author === 'string' ? s.author : 'Desconocido');

      return {
        title: s.title || 'Sin título',
        author: authorName,
        description: s.description || '',
        id: videoId,
        image: s.thumbnail || s.image || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : ''),
        seconds,
        timestamp,
        type: this.isKaraoke(s.title || '') ? SongType.KARAOKE : SongType.SINGLE,
        url: `https://cdpn.io/pen/debug/oNPzxKo?v=${videoId}`,
        views: Math.max(0, Math.round(Number(s.views) || 0)),
        ago: s.ago || null
      }
    }).filter(s => !!s.id)

    await this.songService.insertBulk(songs)

    return {

      message: 'Listado de canciones encontradas',
      data: songs

    }
  }


  isKaraoke(title: string): boolean {

  if (!title || typeof title !== 'string') return false;

  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const regex = /(karaoke|kara|ktv|instrumental|backing\s*track)/i;

  return regex.test(normalized);
}


}
