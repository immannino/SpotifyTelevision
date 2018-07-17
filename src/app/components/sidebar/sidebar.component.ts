import { Component, ViewEncapsulation } from '@angular/core';
import { DataService } from '../../../lib/service/data/data.service';
import { UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyPlaylistTrack } from '../../../lib/service/spotify/spotify.model';
import { Store } from '@ngxs/store';
import { SetSinglePlaylist, SetPlaylists, SetTrackIndex, SetPlayingSong, SetRepeat, SetShuffle } from '../../shared/spotify.state';
import { SpotifyService } from '../../../lib/service/spotify/spotify.service';
import { Router } from '@angular/router';

@Component({
    moduleId: module.id,
    selector: 'sidebar',
    templateUrl: 'sidebar.html',
    styleUrls: [ 'sidebar.css' ],
    encapsulation: ViewEncapsulation.None,
})
export class SidebarComponent {
    spotifyPlaylists: UserSpotifyPlaylists = null;
    currentSpotifyPlaylistSongs: SpotifyPlaylistTracks = null;
    currentPlayingSpotifySong: SpotifyPlaylistTrack = null;
    selectedPlaylistIndex: number = -1;
    isRandom: boolean = false;
    isRepeat: boolean = false;

    constructor(private store: Store, private dataService: DataService, private spotifyService: SpotifyService, private router: Router) {
        this.dataService.userPlaylistsSubject.subscribe((playlists) => {
            this.spotifyPlaylists = playlists;
        });

        this.dataService.playlistSubject.subscribe((playlist) => {
            this.currentSpotifyPlaylistSongs = playlist;
        });

        this.dataService.currentSongSubject.subscribe((song) => {
            this.currentPlayingSpotifySong = song;
        })
    }

    expandPlaylist(index: number) {
      // check whether tracks have been loaded or not for this playlist
      this.selectedPlaylistIndex = index;

      if (this.spotifyPlaylists.items[index].tracks_local) {
        this.currentSpotifyPlaylistSongs = this.spotifyPlaylists.items[index].tracks_local;
  
        this.store.dispatch(new SetSinglePlaylist(this.currentSpotifyPlaylistSongs));
      } else {
        this.getSpotifyPlaylistTracks(index);
      }
    }

    getSpotifyPlaylistTracks(index: number) {
      this.spotifyService.getUserPlaylistTracks(this.spotifyPlaylists.items[index].id, this.spotifyPlaylists.items[index].owner.id).subscribe((playlistTracks: SpotifyPlaylistTracks) => {
  
        // Cache local tracks
        this.spotifyPlaylists.items[index].tracks = playlistTracks;
        this.spotifyPlaylists.items[index].tracks_local = playlistTracks;
  
        // Set current list of songs in sidebar 
        this.currentSpotifyPlaylistSongs = playlistTracks;
  
        this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
          this.dataService.updateUserPlaylists(this.spotifyPlaylists);
          if (playlistTracks.next) this.getSpotifyPlaylistTracksPaginate(index, playlistTracks.next);
        });
      }, error => this.handleApiError(error), () => { });
    }
  
    getSpotifyPlaylistTracksPaginate(index: number, paginateUrl: string) {
      this.spotifyService.getUserPlaylistTracksPaginate(paginateUrl).subscribe((playlistTracks: SpotifyPlaylistTracks) => {
        for (let playlistTrack of playlistTracks.items) {
          this.spotifyPlaylists.items[index].tracks_local.items.push(playlistTrack);
        }
  
        this.store.dispatch(new SetPlaylists(this.spotifyPlaylists)).subscribe(() => {
          if (playlistTracks.next) this.getSpotifyPlaylistTracksPaginate(index, playlistTracks.next);
        });
      }, error => this.handleApiError(error), () => { })
    }

    handleApiError(error: any) {
      if (error) {
        switch (error.status) {
          case 401:
            this.router.navigate(['/login']);
            break;
          default:
            this.router.navigate(['/login']);
        }
      }
    }

    playCurrentSong(index: number) {
        let tempSong = this.spotifyPlaylists.items[this.selectedPlaylistIndex].tracks_local.items[index];
        this.store.dispatch(new SetTrackIndex(index));
        this.store.dispatch(new SetPlayingSong(tempSong));
        this.dataService.updateCurrentSong(tempSong);
        this.currentPlayingSpotifySong = tempSong;
    }

    changeCurrentSong(changeVal: number) {
        this.dataService.toggleNextSong(changeVal);
    }

    shouldDisplaySidebarSongs(index: number): boolean {
      return (index === this.selectedPlaylistIndex && this.currentSpotifyPlaylistSongs !== null);
    }
}