import { Component, ViewChild, ElementRef, NgZone  }       from '@angular/core';
import { LoadingController }          from 'ionic-angular';
import { Config }                     from '../../../app/app.config';
import { Storage }                    from '@ionic/storage';
import { ToastController }            from 'ionic-angular';
import { MouseEvent,
         LatLngLiteral,
         LatLngBounds,
         LatLng,
         AgmCircle,
         MapsAPILoader  }             from '@agm/core';
import { MeetingListProvider }        from '../../../providers/meeting-list/meeting-list';
import { TranslateService }           from '@ngx-translate/core';

declare const google: any;

@Component({
  selector: 'page-address-search',
  templateUrl: 'address-search.html',
})
export class AddressSearchComponent {

  timeDisplay        : string  = "";
  meetingList        : any     = [];
  loader                       = null;
  zoom               : number  = 8;
  mapLatitude        : any     =  51.899 ;
  mapLongitude       : any     = -8.474 ;
  autoRadius         : any;
  map                : any     = null ;
  mapBounds          : LatLngBounds;
  myLatLng           : LatLng;
  circleRadiusMeters : number  = 0 ;
  formattedAddress   : string;

  @ViewChild('circle', {read: AgmCircle}) circle: AgmCircle;
  @ViewChild('searchbar', {read: ElementRef}) searchbar: ElementRef;

  constructor(private MeetingListProvider : MeetingListProvider,
              public  loadingCtrl         : LoadingController,
              private toastCtrl           : ToastController,
              private storage             : Storage,
              private translate           : TranslateService,
              private MapsAPIloader       : MapsAPILoader,
              private zone                : NgZone  ) {

     console.log("AddressSearchComponent: constructor");
  }


  mapReady(event: any) {
    console.log("mapReady : event");
    this.map = event;

    this.storage.get('timeDisplay')
    .then(timeDisplay => {
        if(timeDisplay) {
          console.log("Setting timeDisplay to ", timeDisplay);
          this.timeDisplay = timeDisplay;
        } else {
          this.timeDisplay = "24hr";
        }
        this.storage.get('searchRange')
        .then(searchValue => {
            if(searchValue) {
              this.autoRadius = searchValue;
            } else {
              this.autoRadius = 25;
            }
          this.storage.get('savedLat').then(value => {
            if(value) {
              console.log("mapLatitude was saved previously : ", value);
              this.mapLatitude = value;
              this.storage.get('savedLng').then(value => {
                if(value) {
                  console.log("mapLongitude was saved previously : ", value);
                  this.mapLongitude = value;

                  this.mapLatitude = parseFloat(this.mapLatitude);
                  this.mapLongitude = parseFloat(this.mapLongitude);
                  this.getMeetings();
                } else {
                  console.log("No mapLongitude previously saved");
                }
              });
            } else {
              console.log("No mapLatitude previously saved");
            }
          });
        });
      });
  }


onInput($event) {
   console.log("onInput");
  let autocomplete = new google.maps.places.Autocomplete(this.searchbar.nativeElement.querySelector('.searchbar-input'), {
    types: ["geocode"]
  });

  autocomplete.addListener('place_changed', () => {
    this.zone.run(() => {
      let place = autocomplete.getPlace();
      this.mapLatitude = place.geometry.location.lat();
      this.mapLongitude = place.geometry.location.lng();
      this.formattedAddress = place.formatted_address;
      this.getMeetings();
      console.log(place);
    });
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
        this.meetingList.filter(i => i.start_time = this.convertTo12Hr(i.start_time));

      }

      this.setLatLngOffsets();

      this.dismissLoader();
    });
  }

  setLatLngOffsets() {
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

    } // for

    this.circleRadiusMeters = dist * 1000;
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

  public convertTo12Hr(timeString){
    if (this.timeDisplay == "12hr") {
      var H = +timeString.substr(0, 2);
      var h = H % 12 || 12;
      var ampm = (H < 12 || H === 24) ? " AM" : " PM";
      timeString = h + timeString.substr(2, 3) + ampm;
      return timeString;
    } else {
     return timeString.slice(0, -3);
    }
  }

  public radiusChange() {
    var tempMapBounds = new google.maps.LatLngBounds();

    this.circle.getBounds().then( value => {
      console.log("GetBounds retuned!!", value);

      tempMapBounds.extend(value.getNorthEast());
      tempMapBounds.extend(value.getSouthWest());

      this.mapBounds = tempMapBounds;
    });

  }

  public openMapsLink(destLatitude, destLongitude) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

}
