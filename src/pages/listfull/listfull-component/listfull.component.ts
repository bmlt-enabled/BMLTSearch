import { Component, ViewChild }  from '@angular/core';
import { LoadingController }     from 'ionic-angular';
import { Platform, Content }     from 'ionic-angular';
import { Storage }               from '@ionic/storage';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import { MeetingListProvider }   from '../../../providers/meeting-list/meeting-list';
import { TranslateService }      from '@ngx-translate/core';
import { firstBy }               from 'thenby';
import { InAppBrowser }          from '@ionic-native/in-app-browser';

@Component({
  selector: 'page-listfull',
  templateUrl: 'listfull.html'
})
export class ListfullComponent {

  serviceGroups          : any;
  serviceGroupHierarchy  : any    = [];
  shownDay                        = null;
  shownGroupL1                    = null;
  shownGroupL2                    = null;
  shownGroupL3                    = null;
  shownGroupL4                    = null;
  HTMLGrouping                    = "areas";
  loader                          = null;
  meetingListArea        : any    = [];
  areaName               : any    = "";
  sunCount                        = 0;
  monCount                        = 0;
  tueCount                        = 0;
  wedCount                        = 0;
  thuCount                        = 0;
  friCount                        = 0;
  satCount                        = 0;
  timeDisplay            : string = "";

  constructor( private MeetingListProvider   : MeetingListProvider,
               private ServiceGroupsProvider : ServiceGroupsProvider,
               private loadingCtrl           : LoadingController,
               private translate             : TranslateService,
               private storage               : Storage,
               private iab                   : InAppBrowser  ) {

    this.translate.get('FINDING_MTGS').subscribe(value => {this.presentLoader(value);})

    this.storage.get('timeDisplay')
    .then(timeDisplay => {
        if(timeDisplay) {
          this.timeDisplay = timeDisplay;
        } else {
          this.timeDisplay = "24hr";
        }
      });


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
    this.translate.get('FINDING_MTGS').subscribe(value => {this.presentLoader(value);})
    this.HTMLGrouping = "meetings";
    this.areaName = areaName;
    this.MeetingListProvider.getMeetingsByAreaProvider(areaID).subscribe((data)=>{

      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingListArea = JSON.parse("[]");
      } else {
        this.meetingListArea  = data;
        this.meetingListArea  = this.meetingListArea.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingListArea  = this.meetingListArea.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
        this.meetingListArea.filter(i => i.start_time_set = this.convertTo12Hr(i.start_time));

        this.sunCount = this.meetingListArea.filter(i => i.weekday_tinyint == 1).length;
        this.monCount = this.meetingListArea.filter(i => i.weekday_tinyint == 2).length;
        this.tueCount = this.meetingListArea.filter(i => i.weekday_tinyint == 3).length;
        this.wedCount = this.meetingListArea.filter(i => i.weekday_tinyint == 4).length;
        this.thuCount = this.meetingListArea.filter(i => i.weekday_tinyint == 5).length;
        this.friCount = this.meetingListArea.filter(i => i.weekday_tinyint == 6).length;
        this.satCount = this.meetingListArea.filter(i => i.weekday_tinyint == 7).length;

        this.meetingListArea.sort((a, b) => a.location_sub_province.localeCompare(b.location_sub_province));
        this.meetingListArea = this.groupMeetingList(this.meetingListArea, 'weekday_tinyint');
        for (var i = 0; i < this.meetingListArea.length; i++) {
          this.meetingListArea[i].sort(
            firstBy("weekday_tinyint")
            .thenBy("start_time")
          );
        }

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
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');

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

  showServiceStructure() {
    this.HTMLGrouping = "areas";
    this.areaName = "";
    this.shownDay = null;
//    this.shownGroupL1 = null;
//    this.shownGroupL2 = null;
//    this.shownGroupL3 = null;
//    this.shownGroupL4 = null;
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
