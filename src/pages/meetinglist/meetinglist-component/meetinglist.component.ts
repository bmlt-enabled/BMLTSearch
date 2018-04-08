import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';

import { LoadingController } from 'ionic-angular';

@Component({
  selector: 'page-meetinglist',
  templateUrl: 'meetinglist.html'
})
export class MeetinglistComponent {

  meetingList : any;
  meetingListArea : any;
  meetingListCity : any;
  meetingsListAreaGrouping : string;
  meetingsListCityGrouping : string;
  shownGroup = null;
  loader = null;
  serviceGroupNames : any;
  HTMLGrouping :any;

  constructor(private MeetingListProvider : MeetingListProvider,
              private ServiceGroupsProvider : ServiceGroupsProvider,
              public loadingCtrl: LoadingController,
              public plt: Platform) {

    this.loader = this.loadingCtrl.create({
          content: "Loading..",
          duration: 10000
        });
    this.HTMLGrouping = "area";
    this.loader.present();
    this.meetingsListAreaGrouping = 'service_body_bigint';
    this.meetingsListCityGrouping = 'location_sub_province';
    this.getServiceGroupNames();
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

  getServiceGroupNames() {
    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData)=>{
      this.serviceGroupNames = serviceGroupData;
      this.getAllMeetings();
    });
  }

  getServiceNameFromID(id) {
    var obj = this.serviceGroupNames.find(function (obj) { return obj.id === id; });
    return obj.name;
  }

  getAllMeetings(){
    this.MeetingListProvider.getMeetingsSortedByDay().subscribe((data)=>{
      this.meetingList = data;
      this.meetingList = this.meetingList.filter(meeting => meeting.service_body_bigint = this.getServiceNameFromID(meeting.service_body_bigint));
      this.meetingListCity = this.meetingList.concat();
      this.meetingListArea = this.meetingList.concat();
      this.meetingListArea = this.groupMeetingList(this.meetingListArea, this.meetingsListAreaGrouping);
      this.meetingListCity = this.groupMeetingList(this.meetingListCity, this.meetingsListCityGrouping);

      this.loader.dismiss();
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

}
