import { Component }             from '@angular/core';
import { Storage }               from '@ionic/storage';
import { LoadingController }     from 'ionic-angular';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { Geolocation }           from '@ionic-native/geolocation';
import { GeolocateProvider }     from '../../../providers/geolocate/geolocate';
import firstBy                   from 'thenby';
import thenBy                    from 'thenby';

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
  radius                   : number  = 10;
  radiusMeters             : number  = 10000;
  sunCount                           = 0;
  monCount                           = 0;
  tueCount                           = 0;
  wedCount                           = 0;
  thuCount                           = 0;
  friCount                           = 0;
  satCount                           = 0;

  constructor(private MeetingListProvider   : MeetingListProvider,
              private loadingCtrl           : LoadingController,
              private storage               : Storage,
              private GeolocateProvider     : GeolocateProvider,
              private geolocation           : Geolocation )
  {
    this.meetingsListGrouping = 'weekday_tinyint';

    console.log("getServiceGroupNames");

    this.storage.get('savedAddressLat').then(value => {
			if(value) {
				console.log("addressLatitude was saved previously : ", value);
				this.addressLatitude = value;
				this.storage.get('savedAddressLng').then(value => {
						if(value) {
							console.log("addressLongitude was saved previously : ", value);
							this.addressLongitude = value;
							this.storage.get('savedAddress').then(value => {
									if(value) {
										console.log("Address was saved previously : ", value);
										this.currentAddress = value;
                    this.getAllMeetings();
									} else {
										console.log("No Address previously saved");
										this.locatePhone();
									}
							});
						} else {
							console.log("No addressLongitude previously saved");
							this.locatePhone();
						}
				});
			} else {
				console.log("No addressLatitude previously saved");
				this.locatePhone();
			}
		});

  }

  public openMapsLink(destLatitude, destLongitude) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
  }

  getAllMeetings() {
    console.log("getAllMeetings - radius of ", this.radius, " around " , this.addressLatitude, this.addressLongitude);
    this.presentLoader("Finding Meetings ...");
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
    this.presentLoader("Locating Phone ...");
    this.geolocation.getCurrentPosition({timeout: 10000}).then((resp) => {
      console.log('Got location ok');

      this.addressLatitude = resp.coords.latitude;
      this.addressLongitude = resp.coords.longitude;

      this.storage.set('savedAddressLat', this.addressLatitude);
      this.storage.set('savedAddressLng', this.addressLongitude);

      console.log("getAddressFromLocation");
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
      console.log('Error getting location', error);
      this.currentAddress = "Location not found";
      this.dismissLoader();
    });
  }

}
