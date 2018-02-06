import { YoutubeThumbnail } from "../../lib/service/youtube/youtube.model";

export class DashboardPlaylist {
    playlistItem: Array<PlaylistItem>;
}

export class PlaylistItem {
    artist: string;
    title: string;
    youtubeVideoId: string;
    youtubeVideoTitle: string;
    thumbnails: Map<string, YoutubeThumbnail>;
}