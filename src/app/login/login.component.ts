import { Component, OnInit } from '@angular/core';
import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import { Router,  NavigationEnd } from '@angular/router';
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';
import { UserData } from '../../lib/service/spotify/spotify.model';
import { AppConfig } from '../app.config';
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
                const urlParams = new URLSearchParams(event.urlAfterRedirects.split('/login')[1]);

                if (urlParams.get('code')) {
                    let code = urlParams.get('code');
                    this.exchangeAccessToken(code)
                } else {
                    let err: string = localStorage.getItem('auth_error');

                    if (err && err === "true") {
                        this.errorMessagePrimaryText = "Spotify session token has expired."
                        this.errorMessageSubText = "Please log back in.";
                        this.hasErrorOccurred = true;
                    }
                }
                // let data = event.urlAfterRedirects.split("#")[1];

                // if (data && data !== '' && !data.includes("error")) {
                //     let responseItems: string[] = data.split("&");
                //     /**
                //      * In the future, add logic to check that client state key is valid from response; 
                //      */
                //     this.userSpotifyLogin(responseItems);
                // } else {
                
                // }
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
    }

    async handleLogin() {
        await this.generateSpotifyLoginUrl();
    }

    async exchangeAccessToken(code: string) {
        const codeVerifier = window.localStorage.getItem('code_verifier')
        const url = "https://accounts.spotify.com/api/token"
        const redirectURI: string = this.config.getConfig('spotify').redirect_url;
        const params = new URLSearchParams({
                client_id: this.config.getConfig('spotify').clientid,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectURI,
                code_verifier: codeVerifier,
        })
        const payload = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        }
        const body = await fetch(url, payload)
        const response = await body.json();

        if (!response.access_token) {
            this.router.navigate(['/login'])
            return
        }

        let tempUserData: UserData = {
            userAccessToken: response.access_token,
            token_type: response.token_type,
            refreshTokenTimeout: (response.expires_in * 1000) + new Date().getTime(),
            state: response.scope
        };

        await this.store.dispatch(new SetAuth(tempUserData)).toPromise()
        
        if (this.hasErrorOccurred) this.hasErrorOccurred = false;

        this.router.navigate(['/dashboard']);
    }

    async generateSpotifyLoginUrl() {
        const verifyCode = this.generateRandomString(64);
        const codeChallenge = this.base64Encode(await this.sha256(verifyCode))
        const clientID = this.client_id;
        const appRedirectUrl = this.config.getConfig('spotify').redirect_url;
        const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read';
        const authUrl = new URL("https://accounts.spotify.com/authorize");

        window.localStorage.setItem('code_verifier', verifyCode);

        const params = {
            response_type: 'code',
            client_id: clientID,
            scope,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            redirect_uri: appRedirectUrl,
        }

        authUrl.search = new URLSearchParams(params).toString();

        window.location.replace(authUrl.toString());
    }

    generateRandomString(length: number): string {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const values = crypto.getRandomValues(new Uint8Array(length));
        return values.reduce((acc, x) => acc + possible[x % possible.length], "");
    };

    async sha256(plain): Promise<any> {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return window.crypto.subtle.digest('SHA-256', data);
    }

    base64Encode(input: any): any {
        return btoa(String.fromCharCode(...new Uint8Array(input)))
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }
}