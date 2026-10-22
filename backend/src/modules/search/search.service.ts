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

    let search = results.all.filter( (p) => p.type === 'video' )

    let songs: SearchEntity[] = search.map( (s, index) => {

    return {
      title: s.title,
      author: s.author.name,
      description: s.description,
      id: s.videoId,
      image: s.thumbnail || s.image,
      seconds: s.seconds || s.duration.seconds,
      timestamp: s.timestamp || s.duration.timestamp,
      type: this.isKaraoke(s.title) ? SongType.KARAOKE : SongType.SINGLE,
      url: s.url,
      views: s.views,
      ago: s.ago

    }
    })

    this.songService.insertBulk(songs)


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
