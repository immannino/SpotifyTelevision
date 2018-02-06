export class SpotifySong {
    artist: string;
    song: string;

    constructor(artist: string = "", song: string = "") {
        this.artist = artist;
        this.song = song;
    }
}

export class UserData {
    userAccessToken: string;
    refreshTokenTimeout: number;
    state: string;
    token_type: string;

    constructor(token: string = "", timeout: number = 0, token_type: string = "", state: string = "") {
        this.userAccessToken = token;
        this.refreshTokenTimeout = timeout;
        this.state = state;
        this.token_type = token_type;
    }
}