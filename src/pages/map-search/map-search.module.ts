import { NgModule }             from '@angular/core';
import { CommonModule }         from '@angular/common';
import { SharedModule }         from '../../app/shared/shared.module';
import { MapSearchComponent }   from './map-search-component/map-search.component';
import { AgmCoreModule }        from '@agm/core';
import { AgmJsMarkerClustererModule } from '@agm/js-marker-clusterer';
import { Geolocation }          from '@ionic-native/geolocation';
import { PipesModule }          from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    MapSearchComponent
  ],
  imports: [
  	CommonModule,
  	SharedModule,
    PipesModule,
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyAtwUjsIB14f0aHgdLk_JYnUrI0jvczMXw'
    }),
    AgmJsMarkerClustererModule
  ],
  exports: [
    MapSearchComponent
  ],
  entryComponents:[
  	MapSearchComponent
  ]
})
export class MapSearchModule {}
