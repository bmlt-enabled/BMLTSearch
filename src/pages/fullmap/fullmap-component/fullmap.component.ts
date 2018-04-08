import { Component, ViewChild } from '@angular/core';
import { LoadingController } from 'ionic-angular';
import { Platform } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { AgmMap } from '@agm/core';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';

declare const google: any;

@Component({
  templateUrl: 'fullmap.html'
})

export class FullMapComponent {
  meetingList  : any    = [];
  loader                = null;
  zoom         : number = 8;
  latitude     : any    = 43.7782364;
  longitude    : any    = 11.2609586;

  constructor(private MeetingListProvider : MeetingListProvider,
              public  loadingCtrl         : LoadingController,
              public  plt                 : Platform ) {

    this.getMeetings();
  }

  dayOfWeekAsString(dayIndex) {
  	return ["not a day?", "Do", "Lun","Mar","Mer","Gio","Ven","Sab"][dayIndex];
  }

  getMeetings(){
    this.presentLoader("Loading...");
    this.MeetingListProvider.getMeetings().subscribe((data)=>{
      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingList = JSON.parse("[]");
      } else {
        this.meetingList  = data;
        this.meetingList  = this.meetingList.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList  = this.meetingList.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
        this.meetingList  = this.meetingList.filter(meeting => meeting.start_time = (meeting.start_time).substring(0,5));
        this.meetingList  = this.meetingList.filter(meeting => meeting.weekday_tinyint = this.dayOfWeekAsString(meeting.weekday_tinyint));
      }
        var i : any;
        for (i = 0; i < this.meetingList.length - 1; i++) {
          var longOffset : any = 0;
          var latOffset : any = 0;
          var Offset : any = 0.00002;
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
       this.dismissLoader();
    });
  }


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

}
