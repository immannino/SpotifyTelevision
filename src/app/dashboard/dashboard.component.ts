import { Component, OnDestroy, OnInit } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

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
import { Router, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
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
      } else if (event instanceof NavigationEnd) {
        if (!this.spotifyPlaylists) { this.getUserProfileInformation(); }
      } else if (event instanceof NavigationError) {
      } else if (event instanceof NavigationCancel) {
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
  userProfile: SpotifyUserProfile = null;
  selectedPlaylistIndex: number = -1;
  selectedTrackIndex: number = 0;
  player: YT.Player;
  private id: string = 'qDuKsiwS5xw';
  displayYoutubePlayer: boolean = false;

  ngOnInit() {
    if (!localStorage.getItem('userAccessToken')) {
      this.router.navigate(['/login']);
    }
  }

  getUserProfileInformation() {
    this.spotifyService.getSpotifyUserProfile().subscribe((value) => {
      this.userProfile = value;
      this.getUserPlaylists();
    }, (error) => this.handleApiError(error), () => {});
  }

  /**
   * Initial request for user playlists.
   */
  getUserPlaylists() {
    this.spotifyService.getUserPlaylists(this.userProfile.id).subscribe((playlistData) => {
      this.spotifyPlaylists = playlistData;
      if (this.spotifyPlaylists.next) this.userPlaylistPaginate(this.spotifyPlaylists.next);
    }, (error) => this.handleApiError(error), () => {});
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
    }, (error) => this.handleApiError(error), () => {})
  }

  getSpotifyPlaylistTracks(index: number) {
    this.spotifyService.getUserPlaylistTracks(this.spotifyPlaylists.items[index].id, this.spotifyPlaylists.items[index].owner.id).subscribe((playlistTracks) => {

      // Cache local tracks
      this.spotifyPlaylists.items[index].tracks_local = playlistTracks;

      // Set current list of songs in sidebar 
      this.currentSpotifyPlaylistSongs = playlistTracks;

      if (playlistTracks.next) this.getSpotifyPlaylistTracksPaginate(index, playlistTracks.next);
    }, (error) => this.handleApiError(error), () => {});
  }

  getSpotifyPlaylistTracksPaginate(index: number, paginateUrl: string) {
    this.spotifyService.getUserPlaylistTracksPaginate(paginateUrl).subscribe((playlistTracks) => {
      for (let playlistTrack of playlistTracks.items) {
        this.spotifyPlaylists.items[index].tracks_local.items.push(playlistTrack);
        this.currentSpotifyPlaylistSongs.items.push(playlistTrack);
      }

      if (playlistTracks.next) this.getSpotifyPlaylistTracksPaginate(index, playlistTracks.next);
    }, (error) => this.handleApiError(error), () => {})
  }

  expandPlaylist(index: number) {
    // check whether tracks have been loaded or not for this playlist
    if (this.spotifyPlaylists.items[index].tracks_local) {
      this.currentSpotifyPlaylistSongs = this.spotifyPlaylists.items[index].tracks_local;
    } else {
      this.getSpotifyPlaylistTracks(index);
    }

    // If the user wants to collapse the same playlist they just opened.
    if (this.selectedPlaylistIndex === index) {
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
      this.setVideoPlayerSong(cachedVideoId);
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

      if (this.displayYoutubePlayer) {
        this.setVideoPlayerSong(videoId);
      } else {
        this.id = videoId;
        this.displayYoutubePlayer = true;
      }
    }, (error) => this.handleApiError(error), () => {});
  }

  /**
   * Confusing name need to refactor BUT
   * This method sets the "Current playing song" info below the playlists. 
   * 
   * @param index Index of selected song from a playlist
   */
  setCurrentVideoPlayer(index: number) {
    if (!this.currentPlayingSpotifySong) this.currentPlayingSpotifySong = new SimpleSpotifyTrack();

    this.currentPlayingSpotifySong = this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index].track;
  }

  /**
   * Depricated: 
   * Used to build the iframe url to be pased into an iframe. All functionality since has been replaced by youtube-player lib.
   * 
   * @param youtubeVideoId 
   */
  getSingleSongYoutubeVideoUrl(youtubeVideoId: string): string {
    return "https://www.youtube.com/embed/" + youtubeVideoId + '?autoplay=1';
  }

  /**
   * Checks local cache if songs exist for that playlist.
   *  
   * @param index index of song to be checked.
   */
  getCachedVideoId(index: number): string {
    return this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index].youtubeVideoId;
  }

  /**
   * Used by the previous and next buttons to change what song to play. 
   * 
   * @param changeValue 1 or -1
   */
  changeCurrentSong(changeValue: number) {
    if ((this.selectedTrackIndex + changeValue) >= 0 && this.selectedTrackIndex < this.currentSpotifyPlaylistSongs.items.length - 1) {
      this.playCurrentSong(this.selectedTrackIndex + changeValue);
    }
  }

  /**
   * Sets what video is playing in the YT player. 
   * 
   * @param videoId Video to play. 
   */
  setVideoPlayerSong(videoId: string) {
    this.id = videoId;
    this.player.loadVideoById(videoId);
    this.player.playVideo();
  }

  /** 
   * Strictly used for testing. Will delete at some point. 
  */
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

  /**
   * Handles setting the Youtube Player as a callback from the Factory.
   * 
   * @param player The YoutubePlayer singleton. 
   */
  savePlayer(player) {
    this.player = player;
    this.displayYoutubePlayer = true;
    this.player.playVideo();
  }

  /**
   * Handles events that change from the YT Player. 
   * 
   * @param event Youtube Player event status codes.
   */
  onStateChange(event) {
    switch(event.data) {
      case 0: // Status: ended
        this.changeCurrentSong(1);
        break;
      case 1: // Status: playing
      case 2: // Status: paused
      case 3: // Status: buffering
      case 5: // Status: video cued
      default:

    }
  }

  handleApiError(error: any) {
    if (error) {
      switch (error.status) {
        case 401:
          this.router.navigate(['/login']);
          break;
        default:
          //someting
      }
    }
  }
  /** 
   * Cleans up user app cache.
   */
  ngOnDestroy() {
    localStorage.clear();
    localStorage.setItem("auth_error", "true");
  }
}
