import { Component } from '@angular/core';
import { ViewController, NavParams } from "ionic-angular";
import { MeetingListProvider } from "../../../providers/meeting-list/meeting-list";
import { TranslateService } from "@ngx-translate/core";
import { Storage }               from '@ionic/storage';
import { InAppBrowser } from "@ionic-native/in-app-browser";

/**
 * Generated class for the ModalComponent component.
 *
 * See https://angular.io/api/core/Component for more info on Angular
 * Components.
 */
@Component({
  templateUrl: 'modal.html'
})
export class ModalComponent {
  timeDisplay: any;
  text: string;
  title: string;
  meetingList: any;

  constructor( private view: ViewController,
               private translate : TranslateService,
               private navParams: NavParams,
               private storage               : Storage,
               private iab                   : InAppBrowser ,
               private MeetingListProvider : MeetingListProvider) {
    console.log('Hello ModalComponent Component');
    this.storage.get('timeDisplay')
    .then(timeDisplay => {
        if(timeDisplay) {
          this.timeDisplay = timeDisplay;
        } else {
          this.timeDisplay = "24hr";
        }
      });
    this.meetingList = this.navParams.get('data');
  }

  private dismiss(){
    this.view.dismiss();
  }

  public openMapsLink(destLatitude, destLongitude) {
  const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');

}

}
