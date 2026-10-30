import { Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CreateBarDto } from '../../modules/bar/dto/create-bar.dto.js';
import { CreateSongDto } from '../../modules/song/dto/create-song.dto.js';
import { CreateTableDto } from '../../modules/table/dto/create-table.dto.js';

export interface SeedsData {
    bars?: CreateBarDto[];
    tables?: CreateTableDto[];
    songs?: CreateSongDto[];
}

const logger = new Logger('SeedLoader');
let cachedSeeds: SeedsData | null = null;

export function loadSeedsData(): SeedsData {
    if (cachedSeeds) return cachedSeeds;

    const candidatePaths = [
        path.resolve(process.cwd(), 'seeds', 'seeds.json'),
        path.resolve(process.cwd(), 'backend', 'seeds', 'seeds.json'),
        path.resolve(process.cwd(), 'seeds', 'seeds.example.json'),
        path.resolve(process.cwd(), 'backend', 'seeds', 'seeds.example.json'),
    ];

    for (const filePath of candidatePaths) {
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                const parsed: SeedsData = JSON.parse(raw);
                logger.log(`Semillas cargadas desde: ${filePath}`);
                cachedSeeds = parsed;
                return parsed;
            } catch (error: any) {
                logger.error(`Error al parsear el archivo de semillas ${filePath}: ${error?.message || error}`);
            }
        }
    }

    logger.warn('No se encontró ningún archivo de semillas (seeds.json ni seeds.example.json).');
    cachedSeeds = { bars: [], tables: [], songs: [] };
    return cachedSeeds;
}
