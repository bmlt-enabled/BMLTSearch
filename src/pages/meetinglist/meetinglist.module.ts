import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';
import { MeetinglistComponent } from './meetinglist-component/meetinglist.component';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    MeetinglistComponent
  ],
  imports: [
  	CommonModule,
  	SharedModule,
    PipesModule
  ],
  exports: [
    MeetinglistComponent
  ],
  entryComponents:[
  	MeetinglistComponent
  ]
})
export class MeetinglistModule {}
