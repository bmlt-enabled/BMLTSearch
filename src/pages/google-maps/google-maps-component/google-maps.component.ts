import { Component, ViewChild } from '@angular/core';
import { LoadingController } from 'ionic-angular';
import { Platform } from 'ionic-angular';

import { Storage } from '@ionic/storage';
import { ToastController } from 'ionic-angular';
import { Geolocation } from '@ionic-native/geolocation';
import { MouseEvent, LatLngLiteral, LatLngBounds, AgmCircle , AgmMap } from '@agm/core';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';

declare const google: any;

@Component({
  templateUrl: 'google-maps.html'
})

export class GoogleMapsComponent {
  meetingList  : any    = [];
  loader                = null;
  zoom         : number = 8;
  latitude     : any    = 43.7782364;
  longitude    : any    = 11.2609586;
  radius       : number = 25;
  radiusMeters : any    = 25000;
  map          : any;
  @ViewChild('circle', {read: AgmCircle}) circle: AgmCircle;
  mapBounds    : LatLngBounds;

  constructor(private MeetingListProvider : MeetingListProvider,
              public  loadingCtrl         : LoadingController,
              public  plt                 : Platform,
              private geolocation         : Geolocation,
              private toastCtrl           : ToastController,
              private storage             : Storage ) {
    console.log("GoogleMapsComponent: constructor:");
  }


  mapReady(event: any) {
    console.log("mapReady");
    this.map = event;
    console.log("MapReady: after getSearchRadius Radius: ", this.radius , " radiusMeters : ", this.radiusMeters);
    this.map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(document.getElementById('LocationButton'));
    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('RadiusRange'));

    this.storage.get('savedLat').then(value => {
      if(value) {
        this.latitude = value;
        console.log("Saved Lat found :", this.latitude);
        this.storage.get('savedLng').then(value => {
          if(value) {
            this.longitude = value;
            console.log("Saved Lng found :", this.longitude);
            this.getCircleMeetings(event);
          } else {
            console.log("No savedLng");
            this.locatePhone();
          }
        });
      } else {
        console.log("No savedLat");
        this.locatePhone();
      }
    });
  }

  dayOfWeekAsString(dayIndex) {
  	return ["not a day?", "Do", "Lun","Mar","Mer","Gio","Ven","Sab"][dayIndex];
  }

  getCircleMeetings(event){
    console.log("getCircleMeetings:");

    if (typeof event === "undefined") {  // spurious event, don't run a search
      return;
    }
    this.presentLoader("Loading...");
    this.MeetingListProvider.getCircleMeetings(this.latitude, this.longitude, this.radius).subscribe((data)=>{
      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingList = JSON.parse("[]");
      } else {
        this.meetingList  = data;
        this.meetingList  = this.meetingList.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList  = this.meetingList.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
        this.meetingList  = this.meetingList.filter(meeting => meeting.start_time = (meeting.start_time).substring(0,5));
        this.meetingList  = this.meetingList.filter(meeting => meeting.weekday_tinyint = this.dayOfWeekAsString(meeting.weekday_tinyint));
      }
        var i : any;
        for (i = 0; i < this.meetingList.length - 1; i++) {
          var longOffset : any = 0;
          var latOffset : any = 0;
          var Offset : any = 0.00002;
          // maybe use :- https://github.com/TopicFriends/TopicFriends/commit/d6c61ae976eb1473b314bd804cebacd5106dac37
          while ((this.meetingList[i].longitude == this.meetingList[i+1].longitude) &&
                 (this.meetingList[i].latitude == this.meetingList[i+1].latitude) ){
            if ( (i % 2) === 1) {
              longOffset += Offset;
              this.meetingList[i].longitude = this.meetingList[i].longitude  + longOffset;
            } else {
              latOffset += Offset;
              this.meetingList[i].latitude = this.meetingList[i].latitude  + latOffset;
            }
            i++;
            if (i == (this.meetingList.length - 1)) {
              longOffset = 0;
              latOffset = 0;
              break;
            }
          } // while
        } // for
       this.dismissLoader();
    });
  }

  circleDragEnd($event: MouseEvent) {
    console.log("circleDragEnd:");

    this.latitude = $event.coords.lat;
    this.longitude = $event.coords.lng;
    this.latitude = parseFloat(this.latitude);
    this.longitude = parseFloat(this.longitude);
    this.circle.getBounds().then((bounds) => {
        this.mapBounds =  bounds;
      })
      .catch((err) => {
        console.log("ERROR: this.circle.getBounds() : " , err.message);
    });
    this.getCircleMeetings(event);
  }

  circleRadiusChange(event: any) {
    console.log("circleRadiusChange:");

    this.circle.getBounds().then((bounds) => {
      this.mapBounds =  bounds;
    })
    .catch((err) => {
      console.log("ERROR: this.circle.getBounds() : " , err.message);
    });
    this.radiusMeters = this.radius * 1000;
    this.getCircleMeetings(event);
  }

  public openMapsLink(destLatitude, destLongitude) {
    console.log("openMapsLink:");

    // ios
    if (this.plt.is('ios')) {
      window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
    };
    // android
    if (this.plt.is('android')) {
      window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
    };
  }

  presentLoader(loaderText) {
    console.log("presentLoader:");

    if (!this.loader) {
      this.loader = this.loadingCtrl.create({
        content: loaderText
      });
      this.loader.present();
    }
  }

  dismissLoader() {
    console.log("dismissLoader:");

    if(this.loader){
      this.loader.dismiss();
      this.loader = null;
    }
  }

  locatePhone() {
    console.log("locatePhone:");

    this.presentLoader("Locating..");
    this.geolocation.getCurrentPosition({timeout: 5000}).then((resp) => {
      this.latitude = resp.coords.latitude;
      this.longitude = resp.coords.longitude;
      this.radius = 5;
      this.radiusMeters = this.radius * 1000
      this.dismissLoader();
      this.getCircleMeetings(event);
    }).catch((error) => {
      console.log('Error getting location', error);
      this.radius = 5;
      this.radiusMeters = this.radius * 1000
      this.dismissLoader();
    });
  }
}
