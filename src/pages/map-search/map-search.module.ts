import { NgModule }             from '@angular/core';
import { CommonModule }         from '@angular/common';
import { SharedModule }         from '../../app/shared/shared.module';
import { MapSearchComponent }   from './map-search-component/map-search.component';
import { IonicPageModule }      from 'ionic-angular';
import { PipesModule }          from '../../pipes/pipes.module';
import { ModalComponent } from "../modal/modal-component/modal.component";

@NgModule({
  declarations: [
    MapSearchComponent
  ],
  imports: [
    CommonModule,
  	SharedModule,
    PipesModule,
    IonicPageModule.forChild(MapSearchComponent),
  ],
  exports: [
    MapSearchComponent
  ],
  entryComponents:[
  	MapSearchComponent
  ],
  providers: [
    ModalComponent
  ]
})
export class MapSearchModule {}
