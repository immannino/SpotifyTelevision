import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

import { YoutubeService } from '../lib/service/youtube/youtube.service';
import { YoutubeSearch } from '../lib/service/youtube/youtube.model';
import { SpotifySong } from '../lib/service/spotify/spotify.model';

import * as data from './testdata.json';

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

  changeVideo(index: number) {
    this.youtubeIframeUrl = this.youtubeIframeUrls[index];
  }

  getResponse() {
    let songs: Array<SpotifySong> = this.getTestData();
    this.youtubeIframeUrls = new Array<SafeResourceUrl>();
    this.youtubeVideos = new Array<YoutubeSearch>();

    for (let song of songs) {
      this.youtubeService.searchYoutube(song).subscribe(data => {
        let tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + data.items[0].id.videoId + '?autoplay=1');//'?enablejsapi=1&origin=http://example.com');
        this.youtubeIframeUrls.push(tempSanitizedUrl);
        this.youtubeVideos.push(data);

        if(!this.youtubeIframeUrl) { this.youtubeIframeUrl = tempSanitizedUrl }

        tempSanitizedUrl = null;
      })
    }
    console.log(this.youtubeIframeUrls);
    console.log(this.youtubeVideos);
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
