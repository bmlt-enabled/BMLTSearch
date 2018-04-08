import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';
import { GoogleMapsComponent } from './google-maps-component/google-maps.component';
import { AgmCoreModule } from '@agm/core';
import { AgmJsMarkerClustererModule } from '@agm/js-marker-clusterer';
import { Geolocation } from '@ionic-native/geolocation';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    GoogleMapsComponent
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
    GoogleMapsComponent
  ],
  entryComponents:[
  	GoogleMapsComponent
  ]
})
export class GoogleMapsModule {}
