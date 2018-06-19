import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { APP_INITIALIZER } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { AppConfig }       from './app.config';
import { RouterModule, Routes } from '@angular/router';

// import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';

import { AppRoutingModule } from './app-routes.module';
import { AppMaterialsModule } from './app-materials.module';
import { YoutubePlayerModule } from 'ngx-youtube-player';

import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FourOhFourComponent } from './fourOhFour.component';
import { SafeUrlPipe } from '../lib/utils/safeurl.pipe';

import { AuthenticationService } from '../lib/service/authentication/authentication.service';
import { SpotifyService } from '../lib/service/spotify/spotify.service';
import { YoutubeService } from '../lib/service/youtube/youtube.service';
import { NgxsModule } from '@ngxs/store';
import { SpotifyAuthState } from './shared/auth.state';
import { SpotifyDataState } from './shared/spotify.state';
import { DataService } from '../lib/service/data/data.service';
import { VideoComponent } from './components/video/video.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    FourOhFourComponent,
    VideoComponent,
    SidebarComponent,
    SafeUrlPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    AppMaterialsModule,
    NgxsModule.forRoot([SpotifyAuthState, SpotifyDataState]),
    YoutubePlayerModule
    // environment.production ? ServiceWorkerModule.register('/ngsw-worker.js') : []
  ],
  providers: [
    YoutubeService,
    SpotifyService,
    AuthenticationService,
    DataService,
    AppConfig,
    { provide: APP_INITIALIZER, useFactory: (config: AppConfig) => () => config.load(), deps: [AppConfig], multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
