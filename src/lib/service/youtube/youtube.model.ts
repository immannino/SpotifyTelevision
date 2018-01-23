export class YoutubeSearch {
    kind: string;
    etag: string;
    items: YoutubeSearch;
    id: YoutubeId;
    snippet: YoutubeSnippet;
    channelTitle: string;
    liveBroadcastContent: string;
}

export class YoutubeId {
    kind: string;
    videoId: string;
    channelId: string;
    playlistId: string;
}

export class YoutubeSnippet {
    publishedAt: Date;
    channelId: string;
    title: string;
    description: string;
    thumbnails: Map<string, YoutubeThumbnail>;
}

export class YoutubeThumbnail {
    url: string;
    width: number;
    height: number;
}

