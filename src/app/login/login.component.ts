import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppMaterialsModule } from '../app-materials.module';
import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterModule, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';
import { SafeUrlPipe } from '../../lib/utils/safeurl.pipe';
import { UserData } from '../../lib/service/spotify/spotify.model';
import { AppConfig } from '../app.config';
import { Timestamp } from 'rxjs';
import { Store } from '@ngxs/store';
import { SetAuth } from '../shared/auth.state';

@Component({
    moduleId: module.id,
    selector: 'login',
    templateUrl: 'login.html',
    styleUrls: [ 'login.css' ]
})
export class LoginComponent implements OnInit {
    constructor(
        private config: AppConfig, 
        private spotifyService: SpotifyService, 
        private router: Router, 
        private sanitizer: DomSanitizer,
        private store: Store
    ) {
        this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd ) {
                let data = event.urlAfterRedirects.split("#")[1];

                if (data && data !== '' && !data.includes("error")) {
                    let responseItems: string[] = data.split("&");
                    /**
                     * In the future, add logic to check that client state key is valid from response; 
                     */
                    this.userSpotifyLogin(responseItems);
                } else {
                    let currentToken: string = localStorage.getItem('auth_error');

                    if (currentToken && currentToken === "true") {
                        this.errorMessagePrimaryText = "Spotify session token has expired."
                        this.errorMessageSubText = "Please log back in.";
                        this.hasErrorOccurred = true;
                    }
                }
            }
          });
    }

    title = 'Spotify Television';
    errorMessagePrimaryText: string = "";
    errorMessageSubText: string = "";
    hasErrorOccurred: boolean = false;
    hrefUrl: SafeResourceUrl = "";
    client_id: string;

    ngOnInit() {
        this.client_id =  this.config.getConfig('spotify').clientid;
        this.generateSpotifyLoginUrl();
    }

    userSpotifyLogin(responseItems: string[]) {
        let tempUserData: UserData = {
            userAccessToken: responseItems[0].split("=")[1],
            token_type: responseItems[1].split("=")[1],
            refreshTokenTimeout: Number(responseItems[2].split("=")[1]),
            state: responseItems[3].split("=")[1]
        };

        this.store.dispatch(new SetAuth(tempUserData)).subscribe(() => {
            
        });
        
        if (this.hasErrorOccurred) this.hasErrorOccurred = false;

        this.navigateToDashboard();
    }

    generateSpotifyLoginUrl() {
        let clientStateKey = this.spotifyService.generateRandomString(50);
        // let appRedirectUrl: string = "http://localhost:4200/login";
        // let appRedirectUrl: string = "http://10.0.0.101:4200/login";
        let appRedirectUrl: string = this.config.getConfig('spotify').redirect_url;
        
        /**
         * Update scopes to appropriate values for what information I'm requesting from the user.
         */
        let scopes: string = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read';

        let url = 'https://accounts.spotify.com/authorize' +
        '?client_id=' + this.client_id +
        '&redirect_uri=' + encodeURIComponent(appRedirectUrl) +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&response_type=token' + '&state=' + clientStateKey;

        this.hrefUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    authUser() {
        this.navigateToDashboard();
    }

    navigateToDashboard() {
        this.router.navigate(['/dashboard']);
    }
}