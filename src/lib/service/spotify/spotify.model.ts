/**
 * Depricated: Was used for initial testing.
 * 
 * Replaced by SpotifyTrack Object (simplified)
 */
export class SpotifySong {
    artist: string;
    song: string;

    constructor(artist: string = "", song: string = "") {
        this.artist = artist;
        this.song = song;
    }
}

/**
 * UserData for Spotify User Auth data. 
 */
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

/**
 * Object representation of users Spotify Playlists
 */
export class UserSpotifyPlaylists {
    href: string;
    items: SpotifyPlaylist[];
}

/**
 * Object representation of a single Spotify Playlist
 */
export class SpotifyPlaylist {
    collaborative: boolean;
    externalUrls: string;
    href: string;
    id: string;
    images: string[];
    name: string;
    owner: SpotifyPlaylistOwner;
    public: boolean;
    snapshot_id: string;
    tracks: SpotifyTrackReference;
    tracks_local: SpotifyPlaylistTracks;
    type: string;
    uri: string;
}

/**
 * Owner object. Straightforward. 
 */
export class SpotifyPlaylistOwner {
    external_urls: SpotifyExternalUrl;
    href: string;
    id: string;
    type: string;
    uri: string;
}

/**
 * Spotify track reference data. 
 */
export class SpotifyTrackReference {
    href: string;
    total: number;
}

/**
 * Straightforward. 
 * 
 * Honestly just to make marshalling 100%.
 */
export class SpotifyExternalUrl {
    spotify: string;
}

export class SpotifyPlaylistTracks {
    href: string;
    items: SpotifyPlaylistTrack[];
}

export class SpotifyPlaylistTrack {
    added_at: string;
    added_by: any;
    is_local: boolean;
    track: SimpleSpotifyTrack;
}

export class SimpleSpotifyTrack {
    artists: SimpleSpotifyArtist;
    href: string;
    id: string;
    name: string;
}

export class SimpleSpotifyArtist {
    external_urls: SpotifyExternalUrl;
    href: string;
    id: string;
    name: string;
    type: string;
    uri: string;
}

export class SpotifyUserProfile {
    country: string;
    display_name: string;
    email: string;
    external_urls: SpotifyExternalUrl;
    followers: SpotifyFollowers;
    href: string;
    id: string;
    images: SpotifyUserImage[];
    product: string;
    type: string;
    uri: string;
}

export class SpotifyFollowers {
    href: string;
    total: number;
}

export class SpotifyUserImage {
    height: number;
    url: string;
    width: number;
}