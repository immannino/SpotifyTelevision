import { Injectable } from "@angular/core";
import { UserSpotifyPlaylists, SpotifyPlaylist, SpotifySong, SpotifyPlaylistTrack, SpotifyPlaylistTracks } from "../spotify/spotify.model";
import { Observable, Subject } from "rxjs";
import { Store } from "@ngxs/store";
import { SetPlaylists, SetPlayingSong, SetSinglePlaylist, SetTrackIndex, SetPlayerStatus } from "../../../app/shared/spotify.state";

@Injectable()
export class DataService {
    public userPlaylistsSubject: Subject<UserSpotifyPlaylists> = new Subject<UserSpotifyPlaylists>();
    public playlistSubject: Subject<SpotifyPlaylistTracks> = new Subject<SpotifyPlaylistTracks>();
    public currentSongSubject: Subject<SpotifyPlaylistTrack> = new Subject<SpotifyPlaylistTrack>();
    public playerStatusSubject: Subject<boolean> = new Subject<boolean>();

    constructor(private store: Store) {
    }

    isValidChange(change: number, index: number): boolean {
        //implement this logic from Dashboard Component
        return true;
    }

    /**
     * Refactor and put in Data Service
     * 
     * Used by the previous and next buttons to change what song to play. 
     * 
     * @param changeValue 1 or -1
     */
    getNewSong(changeValue: number): number {
        let state = this.store.snapshot().spotifydata;
        
        // If shuffling, then shuffle.
        if (state.shouldShuffleSongs) {
            return Math.round(Math.random() * (state.currentSpotifyPlaylistSongs.items.length - 1));
        } else {

            // Check if we're in legal bounds of the playlist
            if ((state.trackIndex + changeValue) >= 0 && (state.trackIndex <= state.currentSpotifyPlaylistSongs.items.length - 1)) {

                // if last song in playlist, check if we're going to cycle back to the beginning
                if (((state.trackIndex === state.currentSpotifyPlaylistSongs.items.length - 1) && changeValue == 1 && (state.shouldRepeatSongs))) {
                    return 0;
                } else {

                    // Just play the next song in the playlist
                    return state.trackIndex + changeValue;
                }
            } else {
                // If we're on the first song, and we're going to repeat songs. 
                // Then cycle to the last song in the playlist
                if (state.shouldRepeatSongs && state.trackIndex == 0) {
                    return state.currentSpotifyPlaylistSongs.items.length - 1;
                }
            }
        }
        
        return -1;
    }

    toggleNextSong(change: number) {
        let newIndex: number = this.getNewSong(change);

        if (newIndex > -1) {
            let newSong: SpotifyPlaylistTrack = this.store.snapshot().spotifydata.currentSpotifyPlaylistSongs.items[newIndex];
            
            // Save State
            this.store.dispatch(new SetPlayingSong(newSong));
            this.store.dispatch(new SetTrackIndex(newIndex));

            // Trigger event to let video component know song was updated
            this.updateCurrentSong(newSong);
        }
    }

    updatePlayerStatus(change: boolean) {
        this.store.dispatch(new SetPlayerStatus(change));

        this.playerStatusSubject.next(change);
    }

    updateUserPlaylists(playlists: UserSpotifyPlaylists) {
        this.store.dispatch(new SetPlaylists(playlists));

        this.userPlaylistsSubject.next(playlists);
    }

    updateCurrentPlaylist(playlist: SpotifyPlaylistTracks) {
        this.store.dispatch(new SetSinglePlaylist(playlist));

        this.playlistSubject.next(playlist);
    }

    updateCurrentSong(song: SpotifyPlaylistTrack) {
        this.store.dispatch(new SetPlayingSong(song));

        this.currentSongSubject.next(song);
    }
}