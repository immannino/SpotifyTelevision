import { Injectable } from '@angular/core';
import { Http, Headers, RequestOptions } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/map'

import { AppConfig } from '../../../app/app.config';
import { UserData, UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyUserProfile } from './spotify.model';

@Injectable()
export class SpotifyService {

  constructor(private config: AppConfig, private http: Http) { }

  private userData: UserData = null;
  spotifyApiUrl: string = "https://api.spotify.com/v1";
  /**
   * 
   * TODO:
   * Replace UserData with localstorage for now. 
   * 
   * Just want it working, I'll get the proper design out there soon enough.
   * Currently getting race condition in app.
   */
  getUserData(): UserData {
    return this.userData;
  };

  setUserData(userData: UserData) {
    this.userData = userData;
  };

  getSpotifyUserProfile(): Observable<SpotifyUserProfile> {
    let clientId = this.getUserData().userAccessToken;
    let requestHeaders: Headers = new Headers();
    requestHeaders.append('Authorization', "Bearer " + clientId);
    let options = new RequestOptions({headers: requestHeaders});

    return this.http.get(this.spotifyApiUrl + '/me', options).map(response => response.json());
  }
  /**
   * Get User Playlists:
   * 
   * endpoint: /users/{user_id}/playlists
   */
  getUserPlaylists(user_id: string): Observable<UserSpotifyPlaylists> {
    let clientId = this.getUserData().userAccessToken;
    let requestHeaders: Headers = new Headers();
    requestHeaders.append('Authorization', "Bearer " + clientId);
    let options = new RequestOptions({headers: requestHeaders});

    return this.http.get(this.spotifyApiUrl + '/users/' + user_id + '/playlists?limit=50', options).map(response => response.json());
  }

  /**
   * Get Playlist Tracks 
   * 
   * endpoint: /users/{user_id}/playlists/{playlist_id}/tracks
   */
  getUserPlaylistTracks(playlistId: string, user_id: string): Observable<SpotifyPlaylistTracks> {
    let clientId = this.getUserData().userAccessToken;
    let requestHeaders: Headers = new Headers();
    requestHeaders.append('Authorization', "Bearer " + clientId);
    let options = new RequestOptions({headers: requestHeaders});

    return this.http.get(this.spotifyApiUrl + '/users/' + user_id + '/playlists/' + playlistId + '/tracks', options).map(response => response.json());
  }

  generateRandomString(length: number): string {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  };

}
