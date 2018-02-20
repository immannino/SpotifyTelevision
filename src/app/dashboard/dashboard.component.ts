import { Component, OnDestroy, OnInit } from '@angular/core';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

import { AuthenticationService } from '../../lib/service/authentication/authentication.service';
import { AuthData } from '../../lib/service/authentication/authentication.model';
import { YoutubeService } from '../../lib/service/youtube/youtube.service';
import { YoutubeSearch } from '../../lib/service/youtube/youtube.model';
import { SpotifySong, SpotifyPlaylist, SpotifyUserProfile, UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyPlaylistTrack, SimpleSpotifyTrack } from '../../lib/service/spotify/spotify.model';
import { DashboardPlaylist, PlaylistItem } from './dashboard.model';
import { SafeUrlPipe } from '../../lib/utils/safeurl.pipe';

import * as data from '../testdata.json';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/forkJoin';
import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import { Router, NavigationStart, NavigationEnd, NavigationError, NavigationCancel  } from '@angular/router';
import { EventListener } from '@angular/core/src/debug/debug_node';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  constructor(private authService: AuthenticationService, private youtubeService: YoutubeService, private spotifyService: SpotifyService, private sanitizer: DomSanitizer, private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
          console.log("Navigation starting.");
      } else if (event instanceof NavigationEnd ) {
        if (!this.spotifyPlaylists) { this.getUserProfileInformation(); }
      } else if (event instanceof NavigationError ) {
      } else if (event instanceof NavigationCancel ) {
      }
    });
  }
  /**
   * Current data elements.
   */
  clientId: string = '';
  spotifyPlaylists: UserSpotifyPlaylists = null;
  currentSpotifyPlaylistSongs: SpotifyPlaylistTracks = null;
  currentPlayingSpotifySong: SimpleSpotifyTrack = null;
  selectedPlaylistIndex: number = -1;
  selectedTrackIndex: number = 0;

  /**
   * Old data.
   * In the process of refactoring from POC -> MAE (lol)
   * ignore for the most part. 
   */
  userProfile: SpotifyUserProfile = null;
  youtubeResponse: YoutubeSearch = null;
  youtubeIframeUrl: string = null;
  youtubeIframeUrls: Array<SafeResourceUrl> = null;
  youtubeVideos: Array<YoutubeSearch> = null;
  isVideoListLoaded: boolean = false;

  ngOnInit() {
    if (!localStorage.getItem('userAccessToken')) {
      this.router.navigate(['/login']);
    }
  }

  getUserProfileInformation() {
    this.spotifyService.getSpotifyUserProfile().subscribe((data) => {
      this.userProfile = data;
      this.getUserPlaylists();
    });
  }

  /**
   * Initial request for user playlists.
   */
  getUserPlaylists() {
      this.spotifyService.getUserPlaylists(this.userProfile.id).subscribe((playlistData) => {
        this.spotifyPlaylists = playlistData;
        if (this.spotifyPlaylists.next) this.userPlaylistPaginate(this.spotifyPlaylists.next);
      });
    }

  /**
   * Recursively make pagination calls to the spotify playlist api
   * while the user still has playlists to snag.
   * 
   * @param paginateUrl Url for the next set of playlists.
   */
  userPlaylistPaginate(paginateUrl: string) {
    this.spotifyService.getUserPlaylistPaginate(paginateUrl).subscribe((playlistData) => {
      for (let playlist of playlistData.items) {
        this.spotifyPlaylists.items.push(playlist);
      }

      if (playlistData.next) this.userPlaylistPaginate(playlistData.next);
    })
  }
  
  getSpotifyPlaylistTracks(index: number) {
    this.spotifyService.getUserPlaylistTracks(this.spotifyPlaylists.items[index].id, this.spotifyPlaylists.items[index].owner.id).subscribe((playlistTracks) => {

      // Cache local tracks
      this.spotifyPlaylists.items[index].tracks_local = playlistTracks;

      // Set current list of songs in sidebar 
      this.currentSpotifyPlaylistSongs = playlistTracks;
    });
  }

  expandPlaylist(index: number) {
    // check whether tracks have been loaded or not for this playlist
    if (this.spotifyPlaylists.items[index].tracks_local) {
      this.currentSpotifyPlaylistSongs = this.spotifyPlaylists.items[index].tracks_local;
    } else {
      this.getSpotifyPlaylistTracks(index);
    }

    // If the user wants to collapse the same playlist they just opened.
    if ( this.selectedPlaylistIndex === index) {
      this.selectedPlaylistIndex = -1;
    } else {
      this.selectedPlaylistIndex = index;
    }
  }

  playCurrentSong(index: number) {
    let cachedVideoId = this.getCachedVideoId(index);

    this.selectedTrackIndex = index;

    if (cachedVideoId) {
      this.setCurrentVideoPlayer(index);
      this.youtubeIframeUrl = this.getSingleSongYoutubeVideoUrl(cachedVideoId);
    } else {
      this.getYoutubeVideoForSong(index);
    }
  }

  getYoutubeVideoForSong(index: number) {
    let tempSong: SpotifySong = new SpotifySong(this.currentSpotifyPlaylistSongs.items[index].track.artists[0].name, 
                              this.currentSpotifyPlaylistSongs.items[index].track.name);

    return this.youtubeService.searchYoutube(tempSong).subscribe((response) => {
      let videoId = response.items[0].id.videoId;
      let youtubeUrl = this.getSingleSongYoutubeVideoUrl(videoId);

      //I dont think I need this check. Commenting out until shit breaks or something.
      // if (!this.spotifyPlaylists.items[this.selectedIndex].tracks_local) {
      //   this.spotifyPlaylists.items[this.selectedIndex].tracks_local = new SpotifyPlaylistTracks();
      // }

      this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index].youtubeVideoId = videoId;
      this.setCurrentVideoPlayer(index);
      this.youtubeIframeUrl = youtubeUrl;
    });
  }

  setCurrentVideoPlayer(index: number) {
    if (!this.currentPlayingSpotifySong) this.currentPlayingSpotifySong = new SimpleSpotifyTrack();

    this.currentPlayingSpotifySong = this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index].track;
  }

  getSingleSongYoutubeVideoUrl(youtubeVideoId: string): string {
    return "https://www.youtube.com/embed/" + youtubeVideoId + '?autoplay=1';
  }

  getCachedVideoId(index: number): string {
    return this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index].youtubeVideoId;
  }


  changeCurrentSong(changeValue: number) {
    if ((this.selectedTrackIndex + changeValue) > 0 && this.selectedTrackIndex < this.currentSpotifyPlaylistSongs.items.length - 1) {
      this.playCurrentSong(this.selectedTrackIndex + changeValue);
    }
  }

  // getResponse() {
  //   console.log("GetResponse() was called");
  //   let songs: Array<SpotifySong> = this.getTestData();
  //   let youtubeSearchResponses: Array<Observable<YoutubeSearch>> = new Array<Observable<YoutubeSearch>>();

  //   let requestReferenceIndex = 0;
  //   this.youtubeVideos = new Array<YoutubeSearch>();
  //   this.youtubeIframeUrls = new Array<SafeResourceUrl>();

  //   for (let song of songs) {
  //     youtubeSearchResponses.push(this.youtubeService.searchYoutube(song));
  //   }

  //   Observable.forkJoin(youtubeSearchResponses).subscribe((responses) => {
  //     for (let res of responses) {
  //       // let tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + res.items[0].id.videoId + '?autoplay=1');
  //         // let tempSanitizedUrl: SafeResourceUrl = "";
  //         let tempSanitizedUrl: string = "";
  //       try {
  //         tempSanitizedUrl = res.items[0].id.videoId;
  //         this.youtubeVideos.push(res);
  //         this.youtubeIframeUrls.push(tempSanitizedUrl);
  //         // tempSanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + res.items[0].id.videoId);
  //       } catch (error) {
  //         console.log('Failed to parse video into a usable url. Might have not had a proper video id.');
  //       }
  //     }

  //     let playlistString: string = "?playlist=";
  //     for (let vid of this.youtubeVideos) {
  //       if (vid && vid.items[0] && vid.items[0].id && vid.items[0].id.videoId) {
  //         playlistString = playlistString + vid.items[0].id.videoId + ',';
  //       }
  //     }
  //     playlistString = playlistString.substring(0,playlistString.length - 1);
  //     let thingUrl: string = "http://www.youtube.com/embed/" + this.youtubeIframeUrls[0] + playlistString ;
  //     this.youtubeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(thingUrl);
  //     // this.youtubeIframeUrl = this.youtubeIframeUrls[0];
  //     this.isVideoListLoaded = true;
  //   });
  // }
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
    localStorage.clear();
  }
}
