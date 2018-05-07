import { Component } from '@angular/core';

import { LoadingController }          from 'ionic-angular';
import { Platform } from 'ionic-angular';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import { MeetingListProvider }        from '../../../providers/meeting-list/meeting-list';

import { TranslateService }           from '@ngx-translate/core';
import firstBy from 'thenby';
import thenBy from 'thenby';

@Component({
  selector: 'page-listfull',
  templateUrl: 'listfull.html'
})
export class ListfullComponent {


  serviceGroups: any;
  serviceGroupHierarchy: any = [];
  shownGroup = null;
  HTMLGrouping = "areas";
  loader = null;
  meetingListArea        : any     = [];
  areaName : any = "";

  constructor( private MeetingListProvider : MeetingListProvider,
               private ServiceGroupsProvider : ServiceGroupsProvider,
               private loadingCtrl           : LoadingController,
               private translate           : TranslateService) {

    console.log("ListfullComponent constructor : ", this.serviceGroupHierarchy);
    this.translate.get('LOADING').subscribe(value => {this.presentLoader(value);})
    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData) => {
      this.serviceGroups = serviceGroupData;
      this.serviceGroups.sort(firstBy("parent_id").thenBy("name").thenBy("id"));
      this.serviceGroupHierarchy = this.getServiceHierarchy(this.serviceGroups, 0);
      console.log("Service Group Hierarchy : ", this.serviceGroupHierarchy);
      this.dismissLoader();
    });
  }

  getServiceHierarchy(flatServiceGroups, parent) {
    var serviceGroupHierarchy = [];
    for (var i in flatServiceGroups) {
      if (flatServiceGroups[i].parent_id == parent) {
        var childServiceGroup = this.getServiceHierarchy(flatServiceGroups, flatServiceGroups[i].id);
        if (childServiceGroup.length) {
          flatServiceGroups[i].childServiceGroup = childServiceGroup;
        }
        serviceGroupHierarchy.push(flatServiceGroups[i]);
      }
    }
    return serviceGroupHierarchy;
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

  getMeetingsByArea(areaID, areaName){
    console.log("getMeetingsByArea:");
    this.translate.get('LOADING').subscribe(value => {this.presentLoader(value);})
    this.areaName = areaName;
    this.MeetingListProvider.getMeetingsByAreaProvider(areaID).subscribe((data)=>{
      console.log("getMeetings: subscribe data results");

      if (JSON.stringify(data) == "{}") {  // empty result set!
        console.log("getMeetings: empty result set");
        this.meetingListArea = JSON.parse("[]");
      } else {
        console.log("getMeetings: non-empty result set", data);
        this.meetingListArea  = data;
        this.meetingListArea  = this.meetingListArea.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingListArea  = this.meetingListArea.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));


        this.meetingListArea.sort((a, b) => a.location_sub_province.localeCompare(b.location_sub_province));
        this.meetingListArea = this.groupMeetingList(this.meetingListArea, 'weekday_tinyint');
        for (var i = 0; i < this.meetingListArea.length; i++) {
          this.meetingListArea[i].sort(
            firstBy("weekday_tinyint")
            .thenBy("start_time")
          );
        }


      }
      this.HTMLGrouping = "meetings";
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

  public openMapsLink(destLatitude, destLongitude) {
      window.open('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude + ')', '_system');
  }

  showServiceStructure() {
    this.HTMLGrouping = "areas";
    this.areaName = "";
    this.shownGroup = null;
  }

}
