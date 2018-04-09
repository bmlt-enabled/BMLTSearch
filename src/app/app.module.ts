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
import { TabsModule }            from '../pages/tabs/tabs.module';
import { GoogleMapsModule }      from '../pages/google-maps/google-maps.module';
import { SettingsModule }        from '../pages/settings/settings.module';
import { ContactModule }         from '../pages/contact/contact.module';
import { MeetinglistModule }     from '../pages/meetinglist/meetinglist.module';
import { AddressSearchModule }   from '../pages/address-search/address-search.module';
import { DoIHaveTheBmltModule }  from '../pages/do-i-have-the-bmlt/do-i-have-the-bmlt.module';
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
    TabsModule,
    GoogleMapsModule,
    SettingsModule,
    ContactModule,
    AddressSearchModule,
    DoIHaveTheBmltModule,
    MeetinglistModule
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
