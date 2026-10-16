import { Injectable } from '@nestjs/common';
import * as yt from "yt-search"


@Injectable()
export class SearchService {

  async search(query: string) {
    console.log(yt)

    return yt.search(query)
  }

}
