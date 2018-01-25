import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

import { YoutubeService } from '../lib/service/youtube/youtube.service';
import { YoutubeSearch } from '../lib/service/youtube/youtube.model';
import { SpotifySong } from '../lib/service/spotify/spotify.model';

import * as data from './testdata.json';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/forkJoin';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private youtubeService: YoutubeService, private sanitizer: DomSanitizer) {}

  title = 'A webapp that plays Youtube Videos from your Spotify music.';
  youtubeResponse: YoutubeSearch = null;
  youtubeIframeUrl: SafeResourceUrl = null;
  youtubeIframeUrls: Array<SafeResourceUrl> = null;
  youtubeVideos: Array<YoutubeSearch> = null;
  isLoginVisible: boolean = true;
  isVideoListLoaded: boolean = false;

  changeVideo(index: number) {
    this.youtubeIframeUrl = this.youtubeIframeUrls[index];
  }

  getResponse() {
    let songs: Array<SpotifySong> = this.getTestData();
    let youtubeSearchResponses: Array<Observable<YoutubeSearch>> = new Array<Observable<YoutubeSearch>>();

    let requestReferenceIndex = 0;
    this.youtubeVideos = new Array<YoutubeSearch>();
    this.youtubeIframeUrls = new Array<SafeResourceUrl>();

    for (let song of songs) {
      youtubeSearchResponses.push(this.youtubeService.searchYoutube(song));
    }

    Observable.forkJoin(youtubeSearchResponses).subscribe((responses) => {
      for (let res of responses) {
        let tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + res.items[0].id.videoId + '?autoplay=1');
        this.youtubeVideos.push(res);
        this.youtubeIframeUrls.push(tempSanitizedUrl);
      }
      this.youtubeIframeUrl = this.youtubeIframeUrls[0];
      this.isVideoListLoaded = true;
    });
  }

  getTestData(): Array<SpotifySong> {
    let testData: Array<SpotifySong> = new Array<SpotifySong>();
    let tempSong: SpotifySong = null;

    for (let song of (<any>data)) {
      tempSong = new SpotifySong();
      tempSong.artist = song['artist'];
      tempSong.song = song['song'];
      testData.push(tempSong);
    }

    return testData;
  }
  
  login() {
    this.isLoginVisible = false;
    this.getResponse();
  }
}
