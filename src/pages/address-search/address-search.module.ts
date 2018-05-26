import { NgModule }             from '@angular/core';
import { CommonModule }         from '@angular/common';
import { SharedModule }         from '../../app/shared/shared.module';
import { AgmCoreModule }        from '@agm/core';
import { AgmJsMarkerClustererModule } from '@agm/js-marker-clusterer';
import { Geolocation }          from '@ionic-native/geolocation';
import { PipesModule }          from '../../pipes/pipes.module';

import { AddressSearchComponent } from './address-search-component/address-search.component';

@NgModule({
  declarations: [
    AddressSearchComponent
  ],
  imports: [
    CommonModule,
  	SharedModule,
    PipesModule,
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyAtwUjsIB14f0aHgdLk_JYnUrI0jvczMXw',
      libraries: ['places']
    }),
    AgmJsMarkerClustererModule
    ],
    exports: [
      AddressSearchComponent
    ],
    entryComponents:[
      AddressSearchComponent
    ]
})
export class AddressSearchModule {}
