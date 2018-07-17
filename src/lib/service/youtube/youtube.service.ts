import { Injectable, NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { YoutubeSearch } from './youtube.model';
import { AppConfig } from '../../../app/app.config';
import { SpotifySong } from '../spotify/spotify.model';
import { Observable } from 'rxjs';


@Injectable()
export class YoutubeService {

    constructor(private config: AppConfig, private http: HttpClient) { }

    googleApiUrl: string = "https://www.googleapis.com/youtube/v3/search?";
    apiKey: string = this.config.getConfig('youtube').apikey;
    
    searchYoutube(song: SpotifySong): Observable<YoutubeSearch> {
        let url = this.googleApiUrl + "q=" + song.artist + ' ' + song.song + ' Official Video'+ '&maxResults=1&part=snippet&key=' + this.apiKey;
        return this.http.get<YoutubeSearch>(encodeURI(url));
    }
}
