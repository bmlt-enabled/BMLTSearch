import {
  Component,
  ViewChild,
  ElementRef,
  NgZone
} from '@angular/core';
import { LoadingController } from 'ionic-angular';
import { Config } from '../../../app/app.config';
import { Storage } from '@ionic/storage';
import { ToastController, ViewController } from 'ionic-angular';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { TranslateService } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser';

declare const google: any;

@Component({
  selector: 'page-address-search',
  templateUrl: 'address-search.html',
})



export class AddressSearchComponent {

  timeDisplay: string = "";
  meetingList: any = [];
  loader = null;
  zoom: number = 8;
  mapLatitude: any = 51.899;
  mapLongitude: any = -8.474;

  formattedAddress: string = '';

  GoogleAutocomplete;
  autocompleteItems;
  autocomplete;

  latitude: number = 0;
  longitude: number = 0;



  constructor(private MeetingListProvider: MeetingListProvider,
    public loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private storage: Storage,
    private translate: TranslateService,
    private iab: InAppBrowser,
    public viewCtrl: ViewController,
    private zone: NgZone) {

    this.GoogleAutocomplete = new google.maps.places.AutocompleteService();
    this.autocomplete = { input: '' };
    this.autocompleteItems = [];
  }


  updateSearchResults() {
    if (this.autocomplete.input == '') {
      this.autocompleteItems = [];
      return;
    }
    this.GoogleAutocomplete.getPlacePredictions({ input: this.autocomplete.input },
      (predictions, status) => {
        this.autocompleteItems = [];
        this.zone.run(() => {
          predictions.forEach((prediction) => {
            this.autocompleteItems.push(prediction);
          });
        });
      });
  }

  selectSearchResult(item) {
    console.log(item);
    this.autocompleteItems = [];
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
    if (this.loader) {
      this.loader.dismiss();
      this.loader = null;
    }
  }

  public convertTo12Hr(timeString) {
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



  public openMapsLink(destLatitude, destLongitude) {
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

}
