import { NgModule,
         ErrorHandler }          from '@angular/core';
import { IonicApp,
         IonicModule,
         IonicErrorHandler }     from 'ionic-angular';
import 'rxjs/add/operator/map';
import { ToastController }       from 'ionic-angular';
import { MyApp }                 from './app.component';
import { InAppBrowser }          from '@ionic-native/in-app-browser';
import { Geolocation }           from '@ionic-native/geolocation';
import { SharedModule }          from './shared/shared.module'
import { HomeModule }            from '../pages/home/home.module';
import { MapSearchModule }       from '../pages/map-search/map-search.module';
import { SettingsModule }        from '../pages/settings/settings.module';
import { ContactModule }         from '../pages/contact/contact.module';
import { LocationSearchModule }  from '../pages/location-search/location-search.module';
import { AddressSearchModule }   from '../pages/address-search/address-search.module';
import { DoIHaveTheBmltModule }  from '../pages/do-i-have-the-bmlt/do-i-have-the-bmlt.module';
import { ListfullModule }        from '../pages/listfull/listfull.module';
import { MeetingListProvider }   from '../providers/meeting-list/meeting-list';
import { ServiceGroupsProvider } from '../providers/service-groups/service-groups';
import { GeolocateProvider }     from '../providers/geolocate/geolocate';


@NgModule({
  declarations: [
    MyApp
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    SharedModule,
    HomeModule,
    MapSearchModule,
    SettingsModule,
    ContactModule,
    ListfullModule,
    AddressSearchModule,
    DoIHaveTheBmltModule,
    LocationSearchModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp
  ],
  providers: [
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    InAppBrowser,
    Geolocation,
    ToastController,
    MeetingListProvider,
    ServiceGroupsProvider,
    GeolocateProvider
    ]
})
export class AppModule {}
