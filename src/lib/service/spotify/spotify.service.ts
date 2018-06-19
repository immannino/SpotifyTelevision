import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Headers, RequestOptions } from '@angular/http'
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AppConfig } from '../../../app/app.config';
import { UserData, UserSpotifyPlaylists, SpotifyPlaylistTracks, SpotifyUserProfile } from './spotify.model';
import { Store } from '@ngxs/store';

@Injectable()
export class SpotifyService {

  constructor(private config: AppConfig, private http: HttpClient, private store: Store) { }

  spotifyApiUrl: string = "https://api.spotify.com/v1";
  currentOffset: number = 0;

  /**
   * 
   * Just want it working, I'll get the proper design out there soon enough.
   * Currently getting race condition in app.
   */
  getSpotifyUserProfile(): Observable<SpotifyUserProfile> {
    let headers: HttpHeaders = this.generateRequestOptions();

    return this.http.get<SpotifyUserProfile>(`${this.spotifyApiUrl}/me`, { headers });
  }
  /**
   * Get User Playlists:
   * 
   * endpoint: /users/{user_id}/playlists
   */
  getUserPlaylists(user_id: string) {
    let headers: HttpHeaders = this.generateRequestOptions();
    // return this.http.get('../../../assets/user-playlists.json').map(response => response.json());

    return this.http.get<UserSpotifyPlaylists>(`${this.spotifyApiUrl}/users/${user_id}/playlists?limit=50`, { headers }).pipe(catchError(this.handleError));
  }

  getUserPlaylistPaginate(url: string) {
    let headers: HttpHeaders = this.generateRequestOptions();

    return this.http.get<UserSpotifyPlaylists>(url, { headers }).pipe(catchError(this.handleError));
  }

  /**
   * Get Playlist Tracks 
   * 
   * endpoint: /users/{user_id}/playlists/{playlist_id}/tracks
   */
  getUserPlaylistTracks(playlistId: string, user_id: string) {
    let headers: HttpHeaders = this.generateRequestOptions();
    return this.http.get<SpotifyPlaylistTracks>(`${this.spotifyApiUrl}/users/${user_id}/playlists/${playlistId}/tracks`, { headers }).pipe(catchError(this.handleError));
  }

  getUserPlaylistTracksPaginate(url: string) {
    let headers: HttpHeaders = this.generateRequestOptions();

    return this.http.get<SpotifyPlaylistTracks>(url, { headers }).pipe(catchError(this.handleError));
  }

  getUserLibrarySongs() {
    let headers: HttpHeaders = this.generateRequestOptions();
    return this.http.get<SpotifyPlaylistTracks>(`${this.spotifyApiUrl}/me/tracks?limit=50`, { headers })
      .pipe(catchError(this.handleError));
  }

  getUserLibrarySongsPaginate(url: string) {
    let headers: HttpHeaders = this.generateRequestOptions();

    return this.http.get<SpotifyPlaylistTracks>(url, { headers })
      .pipe(catchError(this.handleError));
  }

  private generateRequestOptions() {
    let clientId = this.store.snapshot().survey.userAccessToken;

    let requestHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientId}`
    });

    return requestHeaders;
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
      status: 400,
      body: {},
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
    return new Observable(
      errorResponse);
  };

}
