import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';
import { TabsComponent } from './tabs-component/tabs.component';

@NgModule({
  declarations: [
    TabsComponent
  ],
  imports: [
  	CommonModule,
  	SharedModule
  ],
  exports: [
    TabsComponent
  ],
  entryComponents:[
  	TabsComponent
  ]
})
export class TabsModule {}
