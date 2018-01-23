import { TestBed, inject } from '@angular/core/testing';

import { YoutubeService } from './youtube.service';

describe('SpotifyService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [YoutubeService]
    });
  });

  it('should be created', inject([YoutubeService], (service: YoutubeService) => {
    expect(service).toBeTruthy();
  }));
});
