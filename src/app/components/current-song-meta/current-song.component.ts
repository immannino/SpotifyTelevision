import { Component } from "@angular/core";
import { Store } from "@ngxs/store";
import { SetShuffle, SetRepeat } from "../../shared/spotify.state";
import { DataService } from "../../../lib/service/data/data.service";
import { SpotifyPlaylistTrack } from "../../../lib/service/spotify/spotify.model";

@Component({
    moduleId: module.id,
    selector: 'current-song',
    templateUrl: 'current-song.html',
    styleUrls: ['current-song.css']
})
export class CurrentSongComponent {
    currentPlayingSpotifySong: SpotifyPlaylistTrack = null;
    playerStatus: boolean = false;
    isRandom: boolean = false;
    isRepeat: boolean = false;
    shuffleImgSrc: string = './assets/shuffle.svg';
    repeatImgSrc: string = './assets/repeat.svg';
    playText: string = 'Play';

    constructor(private store: Store, private dataService: DataService) { 
        this.dataService.currentSongSubject.subscribe((song) => {
            this.currentPlayingSpotifySong = song;
        });

        this.dataService.playerStatusSubject.subscribe((status) => {
            this.playerStatus = status;
        });

        this.dataService.playPauseSubject.subscribe((status) => {
            this.playText = status;
        });
    }

    changeCurrentSong(changeVal: number) {
        this.dataService.toggleNextSong(changeVal);
    }

    setShuffleFlag() {
        if (this.isRandom) {
            this.shuffleImgSrc = "./assets/shuffle.svg";
        } else {
            this.shuffleImgSrc = "./assets/shuffle-green.svg"
        }

        this.isRandom = !this.isRandom;
        this.store.dispatch(new SetShuffle(this.isRandom));
    }

    setRepeatFlag() {
        if (this.isRepeat) {
            this.repeatImgSrc = "./assets/repeat.svg";
        } else {
            this.repeatImgSrc = "./assets/repeat-green.svg"
        }

        this.isRepeat = !this.isRepeat;

        this.store.dispatch(new SetRepeat(this.isRepeat));
    }

    togglePlay() {
        let playPauseText = '';
        this.playerStatus ? playPauseText = 'Pause' : playPauseText = 'Play';

        this.dataService.togglePlayPause(playPauseText);
        this.dataService.updatePlayerStatus(!this.playerStatus);
    }
}