import { NgModule }                           from '@angular/core';
import { NoopAnimationsModule }                 from '@angular/platform-browser/animations';
import { MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule } from '@angular/material';

@NgModule({
  imports: [ NoopAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule ],
  exports: [ NoopAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule ],
})
export class AppMaterialsModule { }