import { Component, ViewChild }  from '@angular/core';
import { LoadingController }     from 'ionic-angular';
import { Platform, Content }     from 'ionic-angular';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { TranslateService }      from '@ngx-translate/core';
import   firstBy                 from 'thenby';
import   thenBy                  from 'thenby';

@Component({
  selector: 'page-listfull',
  templateUrl: 'listfull.html'
})
export class ListfullComponent {

  @ViewChild(Content) content: Content;
  serviceGroups          : any;
  serviceGroupHierarchy  : any = [];
  shownDay                     = null;
  shownGroupL1                 = null;
  shownGroupL2                 = null;
  shownGroupL3                 = null;
  shownGroupL4                 = null;
  HTMLGrouping                 = "areas";
  loader                       = null;
  meetingListArea        : any = [];
  areaName               : any = "";

  constructor( private MeetingListProvider : MeetingListProvider,
               private ServiceGroupsProvider : ServiceGroupsProvider,
               private loadingCtrl           : LoadingController,
               private translate           : TranslateService) {

    this.translate.get('LOADING').subscribe(value => {this.presentLoader(value);})
    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData) => {
      this.serviceGroups = serviceGroupData;
      this.serviceGroups.sort(firstBy("parent_id").thenBy("name").thenBy("id"));
      this.serviceGroupHierarchy = this.getServiceHierarchy(this.serviceGroups, 0);
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

  toggleDay(day) {
    if (this.isDayShown(day)) {
      this.shownDay = null;
    } else {
      this.shownDay = day;
    }
  };

  toggleL1Group(L1group) {
    if (this.isL1GroupShown(L1group)) {
      this.shownGroupL1 = null;
    } else {
      this.shownGroupL1 = L1group;
    }
  };

  toggleL2Group(L2group) {
    if (this.isL2GroupShown(L2group)) {
      this.shownGroupL2 = null;
    } else {
      this.shownGroupL2 = L2group;
    }
  };

  toggleL3Group(L3group) {
    if (this.isL3GroupShown(L3group)) {
      this.shownGroupL3 = null;
    } else {
      this.shownGroupL3 = L3group;
    }
  };

  toggleL4Group(L4group) {
    if (this.isL4GroupShown(L4group)) {
      this.shownGroupL4 = null;
    } else {
      this.shownGroupL4 = L4group;
    }
  };

  isDayShown(day)         {return this.shownDay     === day    ;};
  isL1GroupShown(L1group) {return this.shownGroupL1 === L1group;};
  isL2GroupShown(L2group) {return this.shownGroupL2 === L2group;};
  isL3GroupShown(L3group) {return this.shownGroupL3 === L3group;};
  isL4GroupShown(L4group) {return this.shownGroupL4 === L4group;};

  getMeetingsByArea(areaID, areaName){
    this.translate.get('LOADING').subscribe(value => {this.presentLoader(value);})
    this.areaName = areaName;
    this.MeetingListProvider.getMeetingsByAreaProvider(areaID).subscribe((data)=>{

      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingListArea = JSON.parse("[]");
      } else {
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
      this.content.resize();
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
    this.shownDay = null;
    this.shownGroupL1 = null;
    this.shownGroupL2 = null;
    this.shownGroupL3 = null;
    this.shownGroupL4 = null;
  }

}
