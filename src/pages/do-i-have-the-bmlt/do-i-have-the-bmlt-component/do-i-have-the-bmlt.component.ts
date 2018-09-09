import { Component }             from '@angular/core';
import { Config }                from '../../../app/app.config';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { LoadingController }     from 'ionic-angular';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import { Storage }               from '@ionic/storage';
import { Geolocation }           from '@ionic-native/geolocation';
import { TranslateService }      from '@ngx-translate/core';
import { IonicPage,
         NavController,
         NavParams }             from 'ionic-angular';
import { InAppBrowser }          from '@ionic-native/in-app-browser';


@Component({
  selector: 'page-do-i-have-the-bmlt',
  templateUrl: 'do-i-have-the-bmlt.html',
})
export class DoIHaveTheBmltComponent {

  currentAddress: any = "";
  addressLatitude: any = 0;
  addressLongitude: any = 0;
  loader = null;
  nearestMeeting: any = "";
  serviceGroupNames : any;
  bmltEnabled : string = 'maybe';

  constructor(  private config:                Config,
                private MeetingListProvider:   MeetingListProvider,
                private ServiceGroupsProvider: ServiceGroupsProvider,
                private loadingCtrl:           LoadingController,
                private translate:             TranslateService,
                private storage:               Storage,
                private geolocation:           Geolocation,
                private iab:                   InAppBrowser ) {

    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData)=>{
      this.serviceGroupNames = serviceGroupData;
      this.storage.get('savedAddressLat').then(value => {
        if (value) {
          this.addressLatitude = value;
          this.storage.get('savedAddressLng').then(value => {
            if (value) {
              this.addressLongitude = value;
              this.findNearestMeeting();
            } else {
              this.locatePhone();
            }
          });
        } else {
          this.locatePhone();
        }
  		});
    });
  }

  getServiceNameFromID(id) {
    var obj = this.serviceGroupNames.find(function (obj) { return obj.id === id; });
    return obj.name;
  }

  findNearestMeeting() {
    this.translate.get('LOCATING').subscribe(value => {this.presentLoader(value);})

    this.MeetingListProvider.getNearestMeeting(this.addressLatitude , this.addressLongitude).subscribe((data)=>{
      this.nearestMeeting = data;
      this.nearestMeeting = this.nearestMeeting.filter(meeting => meeting.service_body_bigint = this.getServiceNameFromID(meeting.service_body_bigint));

      this.dismissLoader();
      if ( this.nearestMeeting[0].distance_in_miles < 100 ) {
        this.bmltEnabled = "true";
      } else {
        this.bmltEnabled = "false";
      }
    });
  }

  presentLoader(loaderText) {
    if (this.loader) {
      this.dismissLoader();
    }
    if (!this.loader) {
      this.loader = this.loadingCtrl.create({
        content: loaderText
      });
      this.loader.present();
    }
  }

  dismissLoader() {
    if (this.loader) {
      this.loader.dismiss();
      this.loader = null;
    }
  }

  locatePhone() {
    this.translate.get('LOCATING').subscribe(value => {this.presentLoader(value);})

    this.geolocation.getCurrentPosition({ timeout: 10000 }).then((resp) => {

      this.addressLatitude = resp.coords.latitude;
      this.addressLongitude = resp.coords.longitude;

      this.storage.set('savedAddressLat', this.addressLatitude);
      this.storage.set('savedAddressLng', this.addressLongitude);
      this.findNearestMeeting();

    }).catch((error) => {
      this.currentAddress = "Location not found";
      this.dismissLoader();
    });
  }

  public openLink(url) {
    const browser = this.iab.create(url, '_system');

  }

}
