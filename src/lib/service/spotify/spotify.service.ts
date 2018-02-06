import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { AppConfig } from '../../../app/app.config';

import { UserData } from './spotify.model';

@Injectable()
export class SpotifyService {

  constructor(private config: AppConfig, private http: Http) { }

  private userData: UserData = null;

  getUserData(): UserData {
    return this.userData;
  }

  setUserData(userData: UserData) {
    this.userData = userData;
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
