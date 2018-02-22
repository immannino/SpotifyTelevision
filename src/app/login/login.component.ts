import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppMaterialsModule } from '../app-materials.module';
import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import {MatButtonModule} from '@angular/material/button';
import { Router, RouterModule, NavigationStart, NavigationEnd, NavigationError, NavigationCancel } from '@angular/router';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';
import { SafeUrlPipe } from '../../lib/utils/safeurl.pipe';
import { UserData } from '../../lib/service/spotify/spotify.model';
import { AppConfig } from '../app.config';
import { Timestamp } from 'rxjs/operators/timestamp';

@Component({
    moduleId: module.id,
    selector: 'login',
    templateUrl: 'login.html',
    styleUrls: [ 'login.css' ]
})
export class LoginComponent {
    constructor(private config: AppConfig, private spotifyService: SpotifyService, private router: Router, private sanitizer: DomSanitizer) {
        this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                console.log("Navigation starting.");
            } else if (event instanceof NavigationEnd ) {
                let data = event.urlAfterRedirects.split("#")[1];

                if (data && data !== '' && !data.includes("error")) {
                    let responseItems: string[] = data.split("&");
                    /**
                     * In the future, add logic to check that client state key is valid from response; 
                     */
                    this.userSpotifyLogin(responseItems);
                } else {
                    console.warn("Non-auth event for user.");
                }
            } else if (event instanceof NavigationError ) {
                console.error("Error in Navigation");
            } else if (event instanceof NavigationCancel ) {
                console.log("Navigation Cancelled");
            }
          });
    }

    hrefUrl: SafeResourceUrl = "";
    client_id: string = this.config.getConfig('spotify').clientid;

    ngOnInit() {
        this.generateSpotifyLoginUrl();
    }

    userSpotifyLogin(responseItems: string[]) {
        let tempUserData: UserData = {
            userAccessToken: responseItems[0].split("=")[1],
            token_type: responseItems[1].split("=")[1],
            refreshTokenTimeout: Number(responseItems[2].split("=")[1]),
            state: responseItems[3].split("=")[1]
        };

        localStorage.setItem("userAccessToken", tempUserData.userAccessToken);
        localStorage.setItem("token_timeout", String(Date.now() + tempUserData.refreshTokenTimeout));
        localStorage.setItem("token_type", tempUserData.token_type);
        localStorage.setItem("state", tempUserData.state);

        this.navigateToDashboard();
    }

    generateSpotifyLoginUrl() {
        let clientStateKey = this.spotifyService.generateRandomString(50);
        // let appRedirectUrl: string = "http://localhost:4200/login";
        let appRedirectUrl: string = this.config.getConfig('spotify').redirect_url;
        
        /**
         * Update scopes to appropriate values for what information I'm requesting from the user.
         */
        let scopes: string = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative';

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