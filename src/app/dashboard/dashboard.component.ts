import { Component, OnDestroy, OnInit } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';

import { AuthenticationService } from '../../lib/service/authentication/authentication.service';
import { AuthData } from '../../lib/service/authentication/authentication.model';
import { SpotifySong, SpotifyPlaylist, SpotifyUserProfile, UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyPlaylistTrack, SimpleSpotifyTrack } from '../../lib/service/spotify/spotify.model';
import { DashboardPlaylist, PlaylistItem } from './dashboard.model';
import { SafeUrlPipe } from '../../lib/utils/safeurl.pipe';

import { Observable } from 'rxjs';

import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import { Router, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { EventListener } from '@angular/core/src/debug/debug_node';
import { Store } from '@ngxs/store';
import { SetProfile, SetPlaylists, SetSinglePlaylist, SetPlayingSong } from '../shared/spotify.state';
import { DataService } from '../../lib/service/data/data.service';

@Component({
  selector: 'dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent {
  constructor(private authService: AuthenticationService, private spotifyService: SpotifyService, private router: Router, private store: Store, private dataService: DataService) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if (!this.store.snapshot().spotifydata.spotifyPlaylists) {
          this.getUserProfileInformation();
        } else {
          this.refreshLocalStateData();
        }
      }
    });
  }

  spotifyPlaylists: UserSpotifyPlaylists = null;
  userProfile: SpotifyUserProfile = null;

  ngOnInit() {
    let authData = this.store.snapshot().survey;

    if (!authData.userAccessToken) {
      this.router.navigate(['/login']);
    }
  }

  getUserProfileInformation() {
    this.spotifyService.getSpotifyUserProfile().subscribe((value: SpotifyUserProfile) => {
      this.userProfile = value;
      this.store.dispatch(new SetProfile(this.userProfile)).subscribe(() => {

        /**
         * Prep the playlist variables.
         */
        this.spotifyPlaylists = new UserSpotifyPlaylists();
        this.spotifyPlaylists.items = new Array<SpotifyPlaylist>();

        this.getUserPlaylists();
      });
    }, error => this.handleApiError(error), () => { });
  }

  /**
   * Initial request for user playlists.
   */
  getUserPlaylists() {
    this.spotifyService.getUserPlaylists(this.userProfile.id).subscribe((playlistData: UserSpotifyPlaylists) => {
      this.spotifyPlaylists = playlistData;

      this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
        this.dataService.updateUserPlaylists(this.spotifyPlaylists);

        if (playlistData.next) this.userPlaylistPaginate(playlistData.next);
        else this.getUserLibraryTracks();
      });
    }, (error) => this.handleApiError(error), () => { });
  }

  /**
   * Recursively make pagination calls to the spotify playlist api
   * while the user still has playlists to snag.
   * 
   * @param paginateUrl Url for the next set of playlists.
   */
  userPlaylistPaginate(paginateUrl: string) {
    this.spotifyService.getUserPlaylistPaginate(paginateUrl).subscribe((playlistData: UserSpotifyPlaylists) => {
      for (let playlist of playlistData.items) {
        this.spotifyPlaylists.items.push(playlist);
      }

      this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
        this.dataService.updateUserPlaylists(this.spotifyPlaylists);

        if (playlistData.next) this.userPlaylistPaginate(playlistData.next);
        else this.getUserLibraryTracks();
      });
    }, error => this.handleApiError(error), () => { })
  }

  getUserLibraryTracks() {
    this.spotifyService.getUserLibrarySongs().subscribe((libraryTracks: SpotifyPlaylistTracks) => {
      let tempLocalPlaylists: SpotifyPlaylist = new SpotifyPlaylist();
      tempLocalPlaylists.name = "User Library Songs";
      tempLocalPlaylists.tracks_local = libraryTracks;

      this.spotifyPlaylists.items.unshift(tempLocalPlaylists);
      this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
        this.dataService.updateUserPlaylists(this.spotifyPlaylists);
        if (libraryTracks.next) this.getUserLibraryTracksPaginate(libraryTracks.next);
      });
    }, (error) => this.handleApiError(error), () => { });
  }

  getUserLibraryTracksPaginate(paginateUrl: string) {
    this.spotifyService.getUserLibrarySongsPaginate(paginateUrl).subscribe((libraryTracks: SpotifyPlaylistTracks) => {
      for (let libraryTrack of libraryTracks.items) {
        this.spotifyPlaylists.items[0].tracks_local.items.push(libraryTrack);
      }

      this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
        this.dataService.updateUserPlaylists(this.spotifyPlaylists);
        if (libraryTracks.next) this.getUserLibraryTracksPaginate(libraryTracks.next);
      });
    }, (error) => this.handleApiError(error), () => { })
  }

  handleApiError(error: any) {
    if (error) {
      switch (error.status) {
        case 401:
          this.router.navigate(['/login']);
          break;
        default:
      }
    }
  }

  refreshLocalStateData() {
    let data = this.store.snapshot().spotifydata;

    this.userProfile = data.userProfile;
    this.spotifyPlaylists = data.spotifyPlaylists;
  }

  /** 
   * Cleans up user app cache.
   */
  ngOnDestroy() {
    localStorage.clear();
    localStorage.setItem("auth_error", "true");
  }
}
