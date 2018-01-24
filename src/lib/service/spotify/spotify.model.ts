export class SpotifySong {
    artist: string;
    song: string;

    constructor(artist: string = "", song: string = "") {
        this.artist = artist;
        this.song = song;
    }
}