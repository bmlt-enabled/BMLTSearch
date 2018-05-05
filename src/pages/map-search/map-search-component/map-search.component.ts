import { Component, ViewChild }       from '@angular/core';
import { LoadingController }          from 'ionic-angular';
import { Storage }                    from '@ionic/storage';
import { ToastController }            from 'ionic-angular';
import { Geolocation }                from '@ionic-native/geolocation';
import { MouseEvent,
         LatLngLiteral,
         LatLngBounds,
         LatLng,
         AgmCircle  }                 from '@agm/core';
import { MeetingListProvider }        from '../../../providers/meeting-list/meeting-list';
import { TranslateService }           from '@ngx-translate/core';

declare const google: any;

@Component({
  templateUrl: 'map-search.html'
})

export class MapSearchComponent {

  meetingList        : any     = [];
  loader                       = null;
  zoom               : number  = 8;
  mapLatitude        : any     =  51.899 ;
  mapLongitude       : any     = -8.474 ;
  autoRadius         : any     = 10 ;
  circleRadiusMeters : number  = 0 ;
  map                : any     = null ;
  mapBounds          : LatLngBounds;
  myLatLng           : LatLng;

  @ViewChild('circle', {read: AgmCircle}) circle: AgmCircle;

  constructor(private MeetingListProvider : MeetingListProvider,
              public  loadingCtrl         : LoadingController,
              private geolocation         : Geolocation,
              private toastCtrl           : ToastController,
              private storage             : Storage,
              private translate           : TranslateService  ) {

    console.log("MapSearchComponent: constructor:");

  }

  mapReady(event: any) {
    console.log("mapReady : event");
    this.map = event;
    this.map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(document.getElementById('LocationButton'));
    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('RadiusRange'));

    this.storage.get('savedMapLat').then(value => {
      if(value) {
        console.log("mapLatitude was saved previously : ", value);
        this.mapLatitude = value;
        this.storage.get('savedMapLng').then(value => {
          if(value) {
            console.log("mapLongitude was saved previously : ", value);
            this.mapLongitude = value;

            this.mapLatitude = parseFloat(this.mapLatitude);
            this.mapLongitude = parseFloat(this.mapLongitude);
            this.getMeetings();
          } else {
            console.log("No mapLongitude previously saved");
            this.locatePhone();
          }
        });
      } else {
        console.log("No mapLatitude previously saved");
        this.locatePhone();
      }
    });
  }

  getMeetings(){
    console.log("getMeetings:");
    this.translate.get('LOADINGMAP').subscribe(value => {this.presentLoader(value);})

    this.MeetingListProvider.getAutoRadiusMeetings(this.mapLatitude, this.mapLongitude, this.autoRadius).subscribe((data)=>{
      console.log("getMeetings: subscribe data results");

      if (JSON.stringify(data) == "{}") {  // empty result set!
        console.log("getMeetings: empty result set");
        this.meetingList = JSON.parse("[]");
      } else {
        console.log("getMeetings: non-empty result set", data);
        this.meetingList  = data;
        this.meetingList  = this.meetingList.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList  = this.meetingList.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
      }

      this.setLatLngOffsets();

      this.dismissLoader();
    });
  }

  setLatLngOffsets() {
    if (this.mapBounds) {
      delete this.mapBounds;
    }
    var tempMapBounds = new google.maps.LatLngBounds();

    var i : any;
    var dist : number = 0;
    for (i = 0; i < this.meetingList.length - 1; i++) {
      if (parseFloat(this.meetingList[i].distance_in_km) > dist) {
        dist = parseFloat(this.meetingList[i].distance_in_km);
      }
      var longOffset : any = 0;
      var latOffset  : any = 0;
      var Offset     : any = 0.00002;
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
      if (this.myLatLng) {
        delete this.myLatLng;
      }
      this.myLatLng = new google.maps.LatLng(this.meetingList[i].latitude, this.meetingList[i].longitude);
      tempMapBounds.extend(this.myLatLng);
    } // for

    this.mapBounds = tempMapBounds;

    this.circleRadiusMeters = dist * 1000;
    console.log("setLatLngOffsets : circleRadiusMeters changed to ", this.circleRadiusMeters);
    console.log("setLatLngOffsets : mapBounds ", this.mapBounds);
  }

  circleDragEnd($event: MouseEvent) {
    console.log("circleDragEnd:");

    this.mapLatitude = $event.coords.lat;
    this.mapLongitude = $event.coords.lng;
    this.mapLatitude = parseFloat(this.mapLatitude);
    this.mapLongitude = parseFloat(this.mapLongitude);
    this.getMeetings();
  }

  public openMapsLink(destLatitude, destLongitude) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
  }

  presentLoader(loaderText) {
    if (!this.loader) {
      this.loader = this.loadingCtrl.create({
        content: loaderText
      });
      this.loader.present();
    }
  }

  dismissLoader() {
    if(this.loader){
      this.loader.dismiss();
      this.loader = null;
    }
  }

  locatePhone() {
    this.translate.get('LOCATING').subscribe(
      value => {
        this.presentLoader(value);
      }
    )
    this.geolocation.getCurrentPosition({timeout: 5000}).then((resp) => {

      this.mapLatitude = resp.coords.latitude;
      this.mapLongitude = resp.coords.longitude;

      this.storage.set('savedLat', this.mapLatitude);
      this.storage.set('savedLng', this.mapLongitude);

      this.dismissLoader();
      this.getMeetings();
    }).catch((error) => {
      console.log('Error getting location', error);
      this.dismissLoader();
    });
  }
}
