import { Component }             from '@angular/core';
import { Storage }               from '@ionic/storage';
import { LoadingController }     from 'ionic-angular';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
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
  meetingListArea          : any;
  meetingListCity          : any;
  meetingsListAreaGrouping : string;
  meetingsListCityGrouping : string;
  shownGroup                         = null;
  loader                             = null;
  serviceGroupNames        : any;
  HTMLGrouping             : any;
  currentAddress           : any     = "";
  addressLatitude          : any     = 0;
  addressLongitude         : any     = 0;
  radius                   : number  = 10;
  radiusMeters             : number  = 10000;

  constructor(private MeetingListProvider   : MeetingListProvider,
              private ServiceGroupsProvider : ServiceGroupsProvider,
              private loadingCtrl           : LoadingController,
              private storage               : Storage,
              private GeolocateProvider     : GeolocateProvider,
              private geolocation           : Geolocation )
  {
    this.HTMLGrouping = "area";
    this.meetingsListAreaGrouping = 'service_body_bigint';
    this.meetingsListCityGrouping = 'location_sub_province';

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

    console.log("getServiceGroupNames");
    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData)=>{
      this.serviceGroupNames = serviceGroupData;
      console.log("getServiceGroupNames were found");
    });
  }

  public openMapsLink(destLatitude, destLongitude) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
  }

  getServiceNameFromID(id) {
    var obj = this.serviceGroupNames.find(function (obj) { return obj.id === id; });
    return obj.name;
  }

  getAllMeetings() {
    console.log("getAllMeetings - radius of ", this.radius, " around " , this.addressLatitude, this.addressLongitude);
    this.presentLoader("Finding Meetings ...");
    this.MeetingListProvider.getAddressMeetings(this.addressLatitude , this.addressLongitude, this.radius).subscribe((data)=>{
      this.addressMeetingList = data;
      this.addressMeetingList = this.addressMeetingList.filter(meeting => meeting.service_body_bigint = this.getServiceNameFromID(meeting.service_body_bigint));

      this.meetingListArea = this.addressMeetingList.concat();
      this.meetingListArea.sort((a, b) => a.service_body_bigint.localeCompare(b.service_body_bigint));
      this.meetingListArea = this.groupMeetingList(this.meetingListArea, this.meetingsListAreaGrouping);
      for (var i = 0; i < this.meetingListArea.length; i++) {
        this.meetingListArea[i].sort(
          firstBy("weekday_tinyint")
          .thenBy("start_time")
        );
      }

      this.meetingListCity = this.addressMeetingList.concat();
      this.meetingListCity.sort((a, b) => a.location_sub_province.localeCompare(b.location_sub_province));
      this.meetingListCity = this.groupMeetingList(this.meetingListCity, this.meetingsListCityGrouping);
      for (var i = 0; i < this.meetingListCity.length; i++) {
        this.meetingListCity[i].sort(
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
