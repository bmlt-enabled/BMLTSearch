import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';
import { Geolocation } from '@ionic-native/geolocation';
import { PipesModule } from '../../pipes/pipes.module';

import { AddressSearchComponent } from './address-search-component/address-search.component';
import { ModalModule } from "../modal/modal.module";

@NgModule({
  declarations: [
    AddressSearchComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    PipesModule,
    ModalModule
  ],
  exports: [
    AddressSearchComponent
  ],
  entryComponents: [
    AddressSearchComponent
  ]
})
export class AddressSearchModule { }
