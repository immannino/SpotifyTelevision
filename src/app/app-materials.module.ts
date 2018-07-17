import { NgModule }                           from '@angular/core';
import { NoopAnimationsModule }                 from '@angular/platform-browser/animations';
import { MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule } from '@angular/material';

@NgModule({
  imports: [ NoopAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule ],
  exports: [ NoopAnimationsModule, MatCommonModule, MatButtonModule, MatSidenavModule, MatListModule, MatExpansionModule, MatCardModule, MatTooltipModule ],
})
export class AppMaterialsModule { }