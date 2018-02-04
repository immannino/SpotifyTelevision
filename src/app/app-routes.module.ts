import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';

import { DashboardComponent }   from './dashboard/dashboard.component';
import { LoginComponent }     from './login/login.component';
import { FourOhFourComponent } from './fourOhFour.component';

const appRoutes: Routes = [
    { path: 'login', component: LoginComponent },
    { path: 'dashboard', component: DashboardComponent },
   
    { path: '',   redirectTo: '/login', pathMatch: 'full' },
    { path: '**', component: FourOhFourComponent }
  ];

@NgModule({
  imports: [
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: true } // <-- debugging purposes only
    )
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {}