import { Component }             from '@angular/core';
import { Platform }              from 'ionic-angular';
import { Storage }               from '@ionic/storage';
import { Geolocation }           from '@ionic-native/geolocation';
import { LoadingController }     from 'ionic-angular';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import { GeolocateProvider }     from '../../../providers/geolocate/geolocate';


@Component({
  selector: 'page-meetinglist',
  templateUrl: 'meetinglist.html'
})
export class MeetinglistComponent {

  addressData              : any;
  meetingList              : any;
  meetingListArea          : any;
  meetingListCity          : any;
  meetingsListAreaGrouping : string;
  meetingsListCityGrouping : string;
  shownGroup = null;
  loader = null;
  serviceGroupNames        : any;
  HTMLGrouping             : any;
  currentAddress           : any    = "";
  latitude                 : any    = 0;
  longitude                : any    = 0;
  radius                   : number = 0;
  radiusMeters             : number = 0;

  constructor(private MeetingListProvider   : MeetingListProvider,
              private ServiceGroupsProvider : ServiceGroupsProvider,
              private GeolocateProvider     : GeolocateProvider,
              public  loadingCtrl           : LoadingController,
              public  plt                   : Platform,
              private storage               : Storage,
              private geolocation           : Geolocation )
  {
    this.HTMLGrouping = "area";
    this.meetingsListAreaGrouping = 'service_body_bigint';
    this.meetingsListCityGrouping = 'location_sub_province';
  }


// TODO:
  public openMapsLink(destLatitude, destLongitude) {
    // ios
    if (this.plt.is('ios')) {
      window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
    };
    // android
    if (this.plt.is('android')) {
      window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
    };
  }


  getServiceNameFromID(id) {
    var obj = this.serviceGroupNames.find(function (obj) { return obj.id === id; });
    return obj.name;
  }

  getAllMeetings() {
    console.log("getServiceGroupNames");
    this.presentLoader("Finding Meetings ...");

    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData)=>{
      this.serviceGroupNames = serviceGroupData;

      console.log("getAllMeetings - radius of ", this.radius, " around " , this.latitude, this.longitude);
      this.MeetingListProvider.getCircleMeetings(this.latitude , this.longitude, this.radius).subscribe((data)=>{
        this.meetingList = data;
        this.meetingList = this.meetingList.filter(meeting => meeting.service_body_bigint = this.getServiceNameFromID(meeting.service_body_bigint));
        this.meetingListCity = this.meetingList.concat();
        this.meetingListArea = this.meetingList.concat();
        this.meetingListArea = this.groupMeetingList(this.meetingListArea, this.meetingsListAreaGrouping);
        this.meetingListCity = this.groupMeetingList(this.meetingListCity, this.meetingsListCityGrouping);

        this.dismissLoader();
      });
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
      this.latitude = resp.coords.latitude;
      this.longitude = resp.coords.longitude;
      this.radius = 10;
      this.radiusMeters = this.radius * 1000

      console.log("getAddressFromLocation");
      this.GeolocateProvider.convertLatLong(this.latitude, this.longitude).subscribe((json)=>{
        this.currentAddress = json;
        if (this.currentAddress.results[0]) {
          this.currentAddress = this.currentAddress.results[0].formatted_address;
          this.dismissLoader();
          this.getAllMeetings();
        } else {
          this.dismissLoader();
          this.currentAddress = "Location not found";
        }
      });

    }).catch((error) => {
      console.log('Error getting location', error);
      this.radius = 10;
      this.radiusMeters = this.radius * 1000
      this.currentAddress = "Location not found";
      this.dismissLoader();
    });
  }

}
