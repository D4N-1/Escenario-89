import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { CreateSongDto } from "../../modules/song/dto/create-song.dto";
import { SongService } from "../../modules/song/song.service.js";


@Injectable()
export class SongSeederService implements OnModuleInit {
    private readonly logger = new Logger(SongSeederService.name, { timestamp: true })

    constructor(

        private readonly songService: SongService

    ) {}

    async onModuleInit() {
        
        await this.seedSongs()

        this.logger.debug('Song seeder executed')

    }

    async seedSongs() {

        const songsToCreate: CreateSongDto[] = [
            {
                id: 'nF1Rh3vdaeQ',
                title: 'Turn to Ashes [OFFICIAL] - Elena Siegman - lyrics - Ashes of the Damned',
                description: 'callofduty #blackops7 Listen on your fav streaming service now! https://ffm.to/ashesofthedamned ▻Kevin Sherwood:  ...',
                image: 'https://i.ytimg.com/vi/nF1Rh3vdaeQ/hq720.jpg',
                seconds: 251,
                timestamp: '4:11',
                views: 829362,
                url: 'https://cdpn.io/pen/debug/oNPzxKo?v=nF1Rh3vdaeQ',
                ago: '11mo ago',
                author: 'Kevin Sherwood and 3 more'
            },
            {
                id: '5fmXjVuyVKo',
                title: '115 (Remastered)',
                description: 'Provided to YouTube by Symphonic Distribution 115 (Remastered) · Kevin Sherwood · Elena Siegman Origins (Original Game ...',
                image: 'https://i.ytimg.com/vi/5fmXjVuyVKo/hq720.jpg',
                seconds: 229,
                timestamp: '3:49',
                views: 5447507,
                url: 'https://cdpn.io/pen/debug/oNPzxKo?v=5fmXjVuyVKo',
                ago: null,
                author: 'Kevin Sherwood'
            },
            {
                id: 'LpNVf8sczqU',
                title: 'Clair Obscur: Expedition 33 | Lumière [Official Music Video]',
                description: 'Clair Obscur: Expedition 33 (Original Soundtrack) - Lumière Composed by Lorien Testard ft. Alice Duport-Percier Orchestral ...',
                image: 'https://i.ytimg.com/vi/LpNVf8sczqU/hq720.jpg',
                seconds: 223,
                timestamp: '3:43',
                views: 25017988,
                url: 'https://cdpn.io/pen/debug/oNPzxKo?v=LpNVf8sczqU',
                ago: '1y ago',
                author: 'Sandfall Interactive and Lorien Testard'
            },
            {
                id: 'ESx_hy1n7HA',
                title: 'Mili - world.execute(me);',
                description: 'Get Mili\'s album “Miracle Milk” here: https://mili.lnk.to/jJKqCID Mili 2nd Full Album "Miracle Milk" 2016/10/12 - release - □Now On ...',
                image: 'https://i.ytimg.com/vi/ESx_hy1n7HA/hq720.jpg',
                seconds: 213,
                timestamp: '3:33',
                views: 26225779,
                url: 'https://cdpn.io/pen/debug/oNPzxKo?v=ESx_hy1n7HA',
                ago: '10y ago',
                author: 'Mili'
            }
        ];

        for (const song of songsToCreate) {

            const exist = await this.songService.findOrNull.id(song.id)
            
            if (!exist) await this.songService.create(song)
        }
    }
}