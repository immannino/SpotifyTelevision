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
    apiKeys: string = this.config.getConfig('youtube').data;

    // Start each client off on a random count, 
    // so that all users don't always use the first API Key
    requestCount: number = Math.round(Math.random() * (this.apiKeys.length - 1));

    searchYoutube(song: SpotifySong): Observable<YoutubeSearch> {
        const apiKey = this.getApiKey();
        let url = this.googleApiUrl + "q=" + song.artist + ' ' + song.song + ' Official Video'+ '&maxResults=1&part=snippet&key=' + apiKey;
        return this.http.get<YoutubeSearch>(encodeURI(url));
    }

    // Round robin through the keys in order
    getApiKey() {
        const key = this.apiKeys[this.requestCount % this.apiKeys.length];
        this.requestCount += 1;
        return key;
    }
}
