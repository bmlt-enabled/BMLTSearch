import { Component }             from '@angular/core';
import { Storage }               from '@ionic/storage';
import { LoadingController }     from 'ionic-angular';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { Geolocation }           from '@ionic-native/geolocation';
import { GeolocateProvider }     from '../../../providers/geolocate/geolocate';
import { firstBy }               from 'thenby';
import { TranslateService }      from '@ngx-translate/core';
import { InAppBrowser }          from '@ionic-native/in-app-browser';

@Component({
  templateUrl: 'location-search.html'
})

export class LocationSearchComponent {

  addressData              : any;
  addressMeetingList       : any;
  meetingListGrouped       : any;
  meetingsListGrouping     : string;

  shownGroup                         = null;
  loader                             = null;

  currentAddress           : any     = "";
  addressLatitude          : any     = 0;
  addressLongitude         : any     = 0;
  radius                   : number;
  radiusMeters             : number  = 10000;
  sunCount                           = 0;
  monCount                           = 0;
  tueCount                           = 0;
  wedCount                           = 0;
  thuCount                           = 0;
  friCount                           = 0;
  satCount                           = 0;
  timeDisplay              : string  = "";

  constructor(private MeetingListProvider   : MeetingListProvider,
              private loadingCtrl           : LoadingController,
              private storage               : Storage,
              private translate             : TranslateService,
              private GeolocateProvider     : GeolocateProvider,
              private geolocation           : Geolocation,
              private iab                   : InAppBrowser  )
  {
    this.meetingsListGrouping = 'weekday_tinyint';

    this.storage.get('searchRange')
    .then(searchValue => {
        if(searchValue) {
          this.radius = searchValue;
        } else {
          this.radius = 25;
        }
    });

    this.storage.get('timeDisplay')
    .then(timeDisplay => {
        if(timeDisplay) {
          this.timeDisplay = timeDisplay;
        } else {
          this.timeDisplay = "24hr";
        }

        this.storage.get('savedAddressLat').then(value => {
    			if(value) {
    				this.addressLatitude = value;
    				this.storage.get('savedAddressLng').then(value => {
    						if(value) {
    							this.addressLongitude = value;
    							this.storage.get('savedAddress').then(value => {
    									if(value) {
    										this.currentAddress = value;
                        this.getAllMeetings();
    									} else {
    										this.locatePhone();
    									}
    							});
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

  public openMapsLink(destLatitude, destLongitude) {
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');

  }

  getAllMeetings() {
    this.translate.get('FINDING_MTGS').subscribe(value => {this.presentLoader(value);})
    this.MeetingListProvider.getAddressMeetings(this.addressLatitude , this.addressLongitude, this.radius).subscribe((data)=>{
      this.addressMeetingList = data;

      this.meetingListGrouped = this.addressMeetingList.concat();
      this.sunCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 1).length;
      this.monCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 2).length;
      this.tueCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 3).length;
      this.wedCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 4).length;
      this.thuCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 5).length;
      this.friCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 6).length;
      this.satCount = this.meetingListGrouped.filter(i => i.weekday_tinyint == 7).length;

      this.meetingListGrouped.filter(i => i.start_time_set = this.convertTo12Hr(i.start_time));

      this.meetingListGrouped.sort((a, b) => a.weekday_tinyint.localeCompare(b.weekday_tinyint));
      this.meetingListGrouped = this.groupMeetingList(this.meetingListGrouped, this.meetingsListGrouping);
      for (var i = 0; i < this.meetingListGrouped.length; i++) {
        this.meetingListGrouped[i].sort(
          firstBy("weekday_tinyint")
          .thenBy("start_time")
        );
      }
      this.dismissLoader();
    });
  }

  groupMeetingList(meetingList, groupingOption) {
    // A function to convert a flat json list to an javascript array
    var groupJSONList = function(inputArray, key) {
      return inputArray.reduce(function(ouputArray, currentValue) {
        (ouputArray[currentValue[key]] = ouputArray[currentValue[key]] || []).push(currentValue);
        return ouputArray;
      }, {});
    };
    // Convert the flat json to an array grouped by and indexed by the meetingsListGroupingOne field,
    var groupedByGroupingOne = groupJSONList( meetingList, groupingOption);

    // Make the array a proper javascript array, index by number
    var groupedByGroupingOneAsArray = Object.keys(groupedByGroupingOne).map(function(key) {
      return groupedByGroupingOne[key];
    });

    meetingList = groupedByGroupingOneAsArray;
    return meetingList;
  }

  toggleGroup(group) {
      if (this.isGroupShown(group)) {
          this.shownGroup = null;
      } else {
          this.shownGroup = group;
      }
  };

  isGroupShown(group) {
      return this.shownGroup === group;
  };

  presentLoader(loaderText) {
    if (this.loader) {
      this.dismissLoader() ;
    }
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
    this.translate.get('LOCATING').subscribe(value => {this.presentLoader(value);})
    this.geolocation.getCurrentPosition({timeout: 10000}).then((resp) => {

      this.addressLatitude = resp.coords.latitude;
      this.addressLongitude = resp.coords.longitude;

      this.storage.set('savedAddressLat', this.addressLatitude);
      this.storage.set('savedAddressLng', this.addressLongitude);

      this.GeolocateProvider.convertLatLong(this.addressLatitude, this.addressLongitude).subscribe((json)=>{
        this.currentAddress = json;
        if (this.currentAddress.results[0]) {
          this.currentAddress = this.currentAddress.results[0].formatted_address;
          this.storage.set('savedAddress', this.currentAddress);

          this.dismissLoader();
          this.getAllMeetings();
        } else {
          this.dismissLoader();
          this.currentAddress = "Location not found";
        }
      });

    }).catch((error) => {
      this.currentAddress = "Location not found";
      this.dismissLoader();
    });
  }

  public isToday(dayOfWeek) {
    var d = new Date();
    var n = d.getDay();
    if (dayOfWeek == (n+1)) {
      return true;
    } else {
      return false;
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

}
