import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpotifyService } from '../../lib/service/spotify/spotify.service';
import { Router, RouterModule } from '@angular/router';

@Component({
    moduleId: module.id,
    selector: 'login',
    templateUrl: 'login.html',
    styleUrls: [ 'login.css' ]
})
export class LoginComponent {
    constructor(private spotifyService: SpotifyService, private router: Router) { }

    @Output() authOccurred = new EventEmitter<boolean>();

    userSpotifyLogin() {
        this.navigateToDashboard();
    }

    authUser() {
        this.navigateToDashboard();
    }

    navigateToDashboard() {
        this.router.navigate(['/dashboard']);
    }
}