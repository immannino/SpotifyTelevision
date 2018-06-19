import { Component } from '@angular/core';
import { DataService } from '../../../lib/service/data/data.service';
import { YoutubeService } from '../../../lib/service/youtube/youtube.service';
import { SpotifyPlaylistTrack, SpotifySong } from '../../../lib/service/spotify/spotify.model';
import { Store } from '@ngxs/store';
import { SetPlayingSong, SetSinglePlaylist } from '../../shared/spotify.state';
import { Router } from '@angular/router';

@Component({
    moduleId: module.id,
    selector: 'video-player',
    templateUrl: 'video.html',
    styleUrls: ['video.css']
})
export class VideoComponent {
    currentSong: SpotifyPlaylistTrack;
    displayYoutubePlayer: boolean = false;
    private id: string = 'qDuKsiwS5xw';
    player: YT.Player;
    isRandom: boolean = false;
    isRepeat: boolean = false;

    constructor(private dataService: DataService, private youtubeService: YoutubeService, private store: Store, private router: Router) {
        this.dataService.currentSongSubject.subscribe((song) => {
            this.currentSong = song;
            this.checkSongCache(song);
        });
    }

    /**
     * Used to build the iframe url to be pased into an iframe. All functionality since has been replaced by youtube-player lib.
     * 
     * @param youtubeVideoId 
     */
    getSingleSongYoutubeVideoUrl(youtubeVideoId: string): string {
        return `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`;
    }

    checkSongCache(song: SpotifyPlaylistTrack) {
        song.youtubeVideoId ? this.setVideoPlayer(song) : this.getYoutubeVideoForSong(song);
    }

    getYoutubeVideoForSong(song: SpotifyPlaylistTrack) {
        let tempSong: SpotifySong = new SpotifySong(song.track.artists[0].name, song.track.name);

        this.youtubeService.searchYoutube(tempSong).subscribe((response) => {
            song.youtubeVideoId = response.items[0].id.videoId;
            let state = this.store.snapshot().spotifydata;

            let tempSongs = state.currentSpotifyPlaylistSongs;
            let index = state.trackIndex;

            tempSongs.items[index].youtubeVideoId = song.youtubeVideoId;

            this.store.dispatch(new SetPlayingSong(song));
            this.store.dispatch(new SetSinglePlaylist(tempSongs));

            this.setVideoPlayer(song);
        }, (error) => this.handleApiError(error), () => { });
    }

    /**
     * Handles setting the Youtube Player as a callback from the lib factory.
     * 
     * @param player The YoutubePlayer singleton. 
     */
    savePlayer(player) {
        this.player = player;
        this.displayYoutubePlayer = true;
        this.player.playVideo();
    }

    setVideoPlayer(song: SpotifyPlaylistTrack) {
        if (this.displayYoutubePlayer) {
            this.setVideoPlayerSong(song.youtubeVideoId);
        } else {
            this.id = song.youtubeVideoId;
            this.displayYoutubePlayer = true;
        }
    }

    setVideoPlayerSong(videoId: string) {
        this.id = videoId;
        this.player.loadVideoById(videoId);
        this.player.playVideo();
    }

    onStateChange(event) {
        switch (event.data) {
            case 0: // Status: ended
                this.dataService.toggleNextSong(1);
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
            }
        }
    }
}