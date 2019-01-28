import { NgModule }                           from '@angular/core';
import { BrowserAnimationsModule }                 from '@angular/platform-browser/animations';
import { MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule } from '@angular/material';

@NgModule({
  imports: [ BrowserAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule ],
  exports: [ BrowserAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule ],
})
export class AppMaterialsModule { }