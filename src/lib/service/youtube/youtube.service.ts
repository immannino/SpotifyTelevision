import { Injectable, NgModule } from '@angular/core';
import { Http } from '@angular/http';
import { YoutubeSearch } from './youtube.model';
import { AppConfig } from '../../../app/app.config';
import { SpotifySong } from '../spotify/spotify.model';
import { Observable } from 'rxjs';
import 'rxjs/add/operator/map'

@Injectable()
export class YoutubeService {

    constructor(private config: AppConfig, private http: Http) { }

    googleApiUrl: string = "https://www.googleapis.com/youtube/v3/search?";
    apiKey: string = this.config.getConfig('youtube').apikey;

    searchYoutube(song: SpotifySong): Observable<YoutubeSearch> {
        let url = this.googleApiUrl + "q=" + song.artist + ' ' + song.song + ' Official Video'+ '&maxResults=1&part=snippet&key=' + this.apiKey;
        return this.http.get(encodeURI(url)).map(response => response.json());
    }

    /**
     * Implement out statistics search. Not sure if I want to add in all this logic right now to handle the search. 
     * I think if I want to implement something like this I might want to consider breaking out the UI portion and
     * the backend portion to offload some of the logic and work that happens on client devices. 
     */
    // getVideoStatistics(videoId: string): Observable<number> {
        
    //     return null;
    // }

}
