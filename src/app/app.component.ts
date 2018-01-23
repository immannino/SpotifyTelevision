import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

import { YoutubeService } from '../lib/service/youtube/youtube.service';
import { YoutubeSearch } from '../lib/service/youtube/youtube.model';
import { SpotifySong } from '../lib/service/spotify/spotify.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  constructor(private youtubeService: YoutubeService, private sanitizer: DomSanitizer) {}

  title = 'I Want My Music Television';
  youtubeResponse: YoutubeSearch = null;
  youtubeIframeUrl: SafeResourceUrl = "";

  getResponse() {
    let song: SpotifySong = new SpotifySong('King Krule', 'Baby Blue');
    // let song: SpotifySong = new SpotifySong('Kanye West', 'Wolves');

    this.youtubeService.searchYoutube(song).subscribe(data => {
      console.log(data);
      this.youtubeIframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl("http://www.youtube.com/embed/" + data.items[0].id.videoId + '?enablejsapi=1&origin=http://example.com');

      this.youtubeResponse = data;
    })
  }
}
