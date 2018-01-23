import { TestBed, inject } from '@angular/core/testing';

import { SpotifyService } from './spotify.service';

describe('SpotifyService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SpotifyService]
    });
  });

  it('should be created', inject([SpotifyService], (service: SpotifyService) => {
    expect(service).toBeTruthy();
  }));
});
