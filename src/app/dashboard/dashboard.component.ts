import { Component, OnDestroy, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

import { AuthenticationService } from '../../lib/service/authentication/authentication.service';
import { AuthData } from '../../lib/service/authentication/authentication.model';
import { YoutubeService } from '../../lib/service/youtube/youtube.service';
import { YoutubeSearch } from '../../lib/service/youtube/youtube.model';
import { SpotifySong } from '../../lib/service/spotify/spotify.model';

import * as data from '../testdata.json';
import { Observable } from 'rxjs/Observable';
import { Subscription }   from 'rxjs/Subscription';
import 'rxjs/add/observable/forkJoin';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  constructor(private authService: AuthenticationService, private youtubeService: YoutubeService, private sanitizer: DomSanitizer) {
    /**
     * This code is supposed to help with Passing the client data to the dashboard.
     * 
     * Currently I have a timing issue since I'm not initializing the Dashboard until I make the subscript call
     * to notify Dashbaord (and its just not quite ready for that)
     * 
     * The subscription model I have in place looks like it makes sense for when child components are
     * already initialized, but not so hot for when they're not. We'll figure it out I guess. 
     * 
     */
    
    //   console.log("Dashboard constructor before subscription");
    // this.subscription = authService.authenticationAnnounced$.subscribe(
    //     authData => {
    //         console.log("We got the subscription update");
    //         this.clientId = authData.clientId;
    //         this.getResponse();
    //   });
  }
  clientId: string = '';
  subscription: Subscription = new Subscription();
  youtubeResponse: YoutubeSearch = null;
  youtubeIframeUrl: SafeResourceUrl = null;
  youtubeIframeUrls: Array<SafeResourceUrl> = null;
  youtubeVideos: Array<YoutubeSearch> = null;
  isVideoListLoaded: boolean = false;

  ngOnInit() {
    let tempAuthData: AuthData = this.authService.getAuthData();
    console.log("onInit");
    this.getResponse();
  }

  changeVideo(index: number) {
    this.youtubeIframeUrl = this.youtubeIframeUrls[index];
  }

  getResponse() {
      console.log("GetResponse() was called");
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
        // let tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + res.items[0].id.videoId + '?autoplay=1');
          // let tempSanitizedUrl: SafeResourceUrl = "";
          let tempSanitizedUrl: string = "";
        try {
          tempSanitizedUrl = res.items[0].id.videoId;
          this.youtubeVideos.push(res);
          this.youtubeIframeUrls.push(tempSanitizedUrl);
          // tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + res.items[0].id.videoId);
        } catch (error) {
          console.log('Failed to parse video into a usable url. Might have not had a proper video id.');
        }
      }

      let playlistString: string = "?playlist=";
      for (let vid of this.youtubeVideos) {
        if (vid && vid.items[0] && vid.items[0].id && vid.items[0].id.videoId) {
          playlistString = playlistString + vid.items[0].id.videoId + ',';
        }
      }
      playlistString = playlistString.substring(0,playlistString.length - 1);
      let thingUrl: string = "http://www.youtube.com/embed/" + this.youtubeIframeUrls[0] + playlistString ;
      this.youtubeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(thingUrl);
      // this.youtubeIframeUrl = this.youtubeIframeUrls[0];
      this.isVideoListLoaded = true;
    });
  }
  /**
   * So basically for this I want to do the following:
   * Build an array of the list ids without converting to a SafeResourceUrl
   * Then on load, create the playlist string starting at the index (Circular array math)
   * 
   * If the user clicks a song, we want to switch to that song, and then build the playlist starting from the next song. 
   * 
   * 
   */
  setPlaylistUrl():string {
    let playlistUrl = "?playlist=";
    return playlistUrl.substring(0,playlistUrl.length - 1);
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

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
