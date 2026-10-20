import { Injectable } from '@nestjs/common';
import * as yt from "yt-search"


@Injectable()
export class SearchService {

  async search(query: string) {

    return yt.search(query)
  }

}
