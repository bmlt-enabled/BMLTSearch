import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../app/shared/shared.module';
import { FullMapComponent } from './fullmap-component/fullmap.component';
import { AgmCoreModule } from '@agm/core';
import { AgmJsMarkerClustererModule } from '@agm/js-marker-clusterer';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    FullMapComponent
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
    FullMapComponent
  ],
  entryComponents:[
  	FullMapComponent
  ]
})
export class FullMapModule {}
