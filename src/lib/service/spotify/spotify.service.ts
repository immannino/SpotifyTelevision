import { Injectable } from '@angular/core';
import { Http, Headers, RequestOptions } from '@angular/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { catchError } from 'rxjs/operators';
import { ErrorObservable } from 'rxjs/observable/ErrorObservable';
import 'rxjs/add/operator/map'

import { AppConfig } from '../../../app/app.config';
import { UserData, UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyUserProfile } from './spotify.model';

@Injectable()
export class SpotifyService {

  constructor(private config: AppConfig, private http: Http) { }

  spotifyApiUrl: string = "https://api.spotify.com/v1";
  currentOffset: number = 0;

  /**
   * 
   * TODO:
   * Replace UserData with localstorage for now. 
   * 
   * Just want it working, I'll get the proper design out there soon enough.
   * Currently getting race condition in app.
   */
  getSpotifyUserProfile(): Observable<SpotifyUserProfile> {
    let options = this.generateRequestOptions();

    return this.http.get(this.spotifyApiUrl + '/me', options).pipe(catchError(this.handleError)).map(response => response.json());
  }
  /**
   * Get User Playlists:
   * 
   * endpoint: /users/{user_id}/playlists
   */
  getUserPlaylists(user_id: string): Observable<UserSpotifyPlaylists> {
    let options = this.generateRequestOptions();
    // return this.http.get('../../../assets/user-playlists.json').map(response => response.json());

    return this.http.get(this.spotifyApiUrl + '/users/' + user_id + '/playlists?limit=50', options).pipe(catchError(this.handleError)).map((response) => {
      // this.currentOffset = this.currentOffset + ((this.currentOffset - response.tracks.total) 
      return response.json();
    });
  }

  getUserPlaylistPaginate(url: string): Observable<UserSpotifyPlaylists>{
    let options = this.generateRequestOptions();

    return this.http.get(url, options).pipe(catchError(this.handleError)).map((response) => {
      return response.json();
    });
  }

  /**
   * Get Playlist Tracks 
   * 
   * endpoint: /users/{user_id}/playlists/{playlist_id}/tracks
   */
  getUserPlaylistTracks(playlistId: string, user_id: string): Observable<SpotifyPlaylistTracks> {
    let options = this.generateRequestOptions();
    return this.http.get(this.spotifyApiUrl + '/users/' + user_id + '/playlists/' + playlistId + '/tracks', options).pipe(catchError(this.handleError)).map(response => response.json());
  }

  getUserPlaylistTracksPaginate(url: string): Observable<SpotifyPlaylistTracks> {
    let options = this.generateRequestOptions();

    return this.http.get(url, options).pipe(catchError(this.handleError)).map(response => response.json());
  }

  getUserLibrarySongs(): Observable<SpotifyPlaylistTracks> {
    let options = this.generateRequestOptions();
    return this.http.get(this.spotifyApiUrl + '/me/tracks', options)
                    .pipe(catchError(this.handleError))
                    .map(response => response.json());
  }

  getUserLibrarySongsPaginate(url: string): Observable<SpotifyPlaylistTracks> {
    let options = this.generateRequestOptions();

    return this.http.get(url, options)
                    .pipe(catchError(this.handleError))
                    .map(response => response.json());
  }
  
  private generateRequestOptions(): RequestOptions {
    let clientId = localStorage.getItem("userAccessToken");
    let requestHeaders: Headers = new Headers();
    requestHeaders.append('Authorization', "Bearer " + clientId);

    let options = new RequestOptions({headers: requestHeaders});
    return options;
  }
  
  generateRandomString(length: number): string {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  };

  private handleError(error: HttpErrorResponse) {
    let errorResponse: any = {
      status:400,
      body:{},
      description: 'Something bad happened; please try again later.'
    }
  if (error.error instanceof ErrorEvent) {
    // A client-side or network error occurred. Handle it accordingly.
    // console.error('An error occurred:', error.error.message);
  } else {
    // The backend returned an unsuccessful response code.
    // The response body may contain clues as to what went wrong,
    // console.error(
    //   `Backend returned code ${error.status}, ` +
    //   `body was: ${error.error}`);
    errorResponse.status = error.status;
    errorResponse.body = error.error;
  }
  // return an ErrorObservable with a user-facing error message
  return new ErrorObservable(
    errorResponse);
};

}
