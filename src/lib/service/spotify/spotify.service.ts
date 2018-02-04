import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class SpotifyService {

  constructor(private http: Http) { }

  authenticate(): Observable<any> {
    let url = this.spotifyUrl + '?response_type=code' +
    '&client_id=' + this.client_id +
    (this.scopes ? '&scope=' + encodeURIComponent(this.scopes) : '') +
    '&redirect_uri=' + encodeURIComponent(this.redirect_uri);
    
    return this.http.get(encodeURI(url)).map(response => response.json());
  }
}
