import {
  Component,
  ViewChild,
  ElementRef,
  NgZone
} from '@angular/core';
import { Config } from '../../../app/app.config';
import { Storage } from '@ionic/storage';
import {
  LoadingController,
  Platform,
  Modal,
  ModalController,
  ModalOptions,
  ViewController} from 'ionic-angular';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { TranslateService } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { Geolocation } from '@ionic-native/geolocation';
import {
  GoogleMaps,
  GoogleMap,
  GoogleMapOptions,
  GoogleMapsEvent,
  MarkerCluster,
  Marker,
  MarkerLabel,
  MarkerOptions,
  MarkerClusterIcon,
  MarkerClusterOptions,
  ILatLng,
  LatLng,
  VisibleRegion,
  CameraPosition,
  Spherical,
  Environment,
  LocationService,
  MyLocation,
  Geocoder,
  GeocoderResult
} from "@ionic-native/google-maps";
import { ModalComponent } from "../../modal/modal-component/modal.component";


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

  autoRadius: number = 5;
  map: GoogleMap;
  visibleRegion: VisibleRegion;
  marker: Marker;
  markers = [];
  meeting: any;
  ids: string;
  data: any;
  mapEventInProgress: boolean = false;
  markerCluster;


  constructor(private MeetingListProvider: MeetingListProvider,
    public loadingCtrl: LoadingController,
    private storage: Storage,
    private platform: Platform,
    private translate: TranslateService,
    private iab: InAppBrowser,
    public viewCtrl: ViewController,
    private zone: NgZone,
    private modal: ModalController) {

    this.GoogleAutocomplete = new google.maps.places.AutocompleteService();
    this.autocomplete = { input: '' };
    this.autocompleteItems = [];
  }

  ionViewDidLoad() {
    this.storage.get('timeDisplay')
      .then(timeDisplay => {
        if (timeDisplay) {
          this.timeDisplay = timeDisplay;
        } else {
          this.timeDisplay = "24hr";
        }
      });

    this.loadMap();
  }


  loadMap() {
    this.translate.get('LOCATING').subscribe(value => { this.presentLoader(value); })

    // This code is necessary for browser
    this.platform.ready().then(() => {
      Environment.setEnv({
        'API_KEY_FOR_BROWSER_RELEASE': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA',
        'API_KEY_FOR_BROWSER_DEBUG': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA'
      });

    });

    LocationService.getMyLocation().then((myLocation: MyLocation) => {

      this.mapLatitude = myLocation.latLng.lat;
      this.mapLongitude = myLocation.latLng.lng;

      let options: GoogleMapOptions = {
        building: true,
        controls: {
          'compass': true,
          'myLocationButton': true,
          'myLocation': true,   // (blue dot)
          'zoom': true,          // android only
          'mapToolbar': true     // android only
        },
        gestures: {
          scroll: true,
          tilt: true,
          zoom: true,
          rotate: true
        },
        camera: {
          target: {
            "lat": this.mapLatitude,
            "lng": this.mapLongitude
          },
          zoom: 10
        }
      }

      this.map = GoogleMaps.create('map_canvas', options);

      this.map.one(GoogleMapsEvent.MAP_READY).then(this.onMapReady.bind(this));
      this.dismissLoader();
    });

  }


  onMapReady() {
    console.log("In onMapReady()");

    this.map.on(GoogleMapsEvent.MAP_DRAG_END).subscribe((params: any[]) => {
      console.log("MAP_DRAG_END");
      // if (this.mapEventInProgress == false) {
      //   this.mapEventInProgress = true;
      //   this.getMeetings(params);
      // } else {
      //   console.log("not processing second event - MAP_DRAG_END")
      // }
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_END).subscribe((params: any[]) => {
      console.log("CAMERA_MOVE_END");
      if (this.mapEventInProgress == false) {
        this.mapEventInProgress = true;
        this.getMeetings(params);
      } else {
        console.log("not processing second event - CAMERA_MOVE_END")
      }
    });

    //    this.map.trigger("GoogleMapsEvent.CAMERA_MOVE_END");
  }


  addCluster() {
    console.log("In addCluster()");

    let markerLabelOptions: MarkerLabel = {
      bold: true,
      fontSize: 15,
      color: "white",
      italic: false
    };

    let markerClusterIconOptions: MarkerClusterIcon[] = [
      { min: 3, max: 10, url: "./assets/markercluster/m1.png", anchor: { x: 16, y: 16 }, label: markerLabelOptions },
      { min: 11, max: 50, url: "./assets/markercluster/m2.png", anchor: { x: 16, y: 16 }, label: markerLabelOptions },
      { min: 51, max: 100, url: "./assets/markercluster/m3.png", anchor: { x: 24, y: 24 }, label: markerLabelOptions },
      { min: 101, max: 500, url: "./assets/markercluster/m4.png", anchor: { x: 24, y: 24 }, label: markerLabelOptions },
      { min: 501, url: "./assets/markercluster/m5.png", anchor: { x: 32, y: 32 }, label: markerLabelOptions }
    ];

    let markerClusterOptions: MarkerClusterOptions = {
      markers: this.markers,
      icons: markerClusterIconOptions,
      boundsDraw: false
    };
    this.deleteCluster();
    this.markerCluster = this.map.addMarkerClusterSync(markerClusterOptions);

    this.markerCluster.on(GoogleMapsEvent.MARKER_CLICK).subscribe((params) => {
      let marker: Marker = params[1];
      this.openModal(marker.get("ID"));
    });
    console.log("Leaving addCluster()");

  }

  deleteCluster() {
    console.log("In deleteCluster()");
    this.markers = [];
    this.markers.length = 0;
    this.meetingList = [];
    this.meetingList.length = 0;
    if (typeof this.markerCluster != "undefined") {
      this.markerCluster.remove();
      this.markerCluster.empty();
      this.markerCluster.destroy();
    }
    console.log("Leaving deleteCluster()");
  }

  getMeetings(params) {
    console.log("In getMeetings()");
    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); })

//    this.deleteCluster();
    let cameraPosition: CameraPosition<ILatLng> = params[0];

    this.mapLatitude = cameraPosition.target.lat;

    this.mapLongitude = cameraPosition.target.lng;

    this.visibleRegion = this.map.getVisibleRegion();

    this.autoRadius = Spherical.computeDistanceBetween(cameraPosition.target, this.visibleRegion.farLeft) / 1000;

    console.log("Calling getRadiusMeetings")
    console.log("this.mapLatitude ", this.mapLatitude)
    console.log("this.mapLongitude", this.mapLongitude)
    console.log("this.autoRadius", this.autoRadius)

    this.MeetingListProvider.getRadiusMeetings(this.mapLatitude, this.mapLongitude, this.autoRadius).subscribe((data) => {
      console.log("Response from getRadiusMeetings")
      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingList = JSON.parse("[]");
      } else {
        this.meetingList = data;
        this.meetingList = this.meetingList.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList = this.meetingList.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
      }
      this.populateMarkers();
      this.addCluster();
      this.dismissLoader();
      this.mapEventInProgress = false;
    });
    console.log("Leaving getMeetings()");

  }


  populateMarkers() {
    console.log("In populateMarkers()");
    this.markers = [];
    let i: number;
    let areColocated: boolean = false;

    for (i = 0; i < this.meetingList.length; i++) {
      let meetingLocation = {
        "lat": this.meetingList[i].latitude,
        "lng": this.meetingList[i].longitude
      };
      if (this.visibleRegion.contains(<LatLng>(meetingLocation))) {
        if (i == (this.meetingList.length - 1)) {
          // Last meeting on the list
          this.pushStandaloneMeeting(i);
        } else {
          // Not the last meeting in the list

          // Is this meeting in the same location as the next meeting on the list?
          areColocated = this.meetingsAreCoLocated(this.meetingList[i], this.meetingList[i + 1]);

          if (areColocated == false) {
            this.pushStandaloneMeeting(i);
          } else {
            // We have the start of some co-located meetings on the list
            this.ids = this.meetingList[i].id_bigint;
            do {
              this.ids += "&meeting_ids[]=" + this.meetingList[i + 1].id_bigint;

              this.data = {
                "position": { "lat": this.meetingList[i].latitude, "lng": this.meetingList[i].longitude },
                "icon": "assets/markercluster/FFFFFF-0.png"
              };
              this.markers.push(this.data);

              i++;
              // Is this the end of the list?
              if (i == (this.meetingList.length - 1)) {
                break;
              }
            } while (this.meetingsAreCoLocated(this.meetingList[i], this.meetingList[i + 1]))

            this.data = {
              "position": { "lat": this.meetingList[i].latitude, "lng": this.meetingList[i].longitude },
              "ID": this.ids,
              "disableAutoPan": true,
              "icon": "assets/markercluster/MarkerRed.png"
            };
            this.markers.push(this.data);
          }
        }
      }
    }
    console.log("Leaving populateMarkers()")
  }

  meetingsAreCoLocated(i, j) {
    let areColocated: boolean = false;
    if (((Math.round(i.latitude * 1000) / 1000) != (Math.round(j.latitude * 1000) / 1000)) ||
      ((Math.round(i.longitude * 1000) / 1000) != (Math.round(j.longitude * 1000) / 1000))) {
      areColocated = false;
    } else {
      areColocated = true;
    }
    return areColocated;
  }

  pushStandaloneMeeting(i) {
    this.data = {
      "position": { "lat": this.meetingList[i].latitude, "lng": this.meetingList[i].longitude },
      "ID": this.meetingList[i].id_bigint,
      "disableAutoPan": true,
      "icon": "assets/markercluster/MarkerBlue.png"
    };
    this.markers.push(this.data);

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
    this.autocomplete.input = item.description;

    // Address -> latitude,longitude
Geocoder.geocode({
  "address": item.description
}).then((results: GeocoderResult[]) => {
  console.log(results);



  // Add a marker
  let marker: Marker = this.map.addMarkerSync({
    'position': results[0].position,
    'title':  item.description
  });

  // Move to the position
  this.map.animateCamera({
    'target': results[0].position,
    'zoom': 10
  }).then(() => {
    marker.showInfoWindow();
  });
});
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

  public openModal(meetingID) {

    this.MeetingListProvider.getSingleMeetingByID(meetingID).subscribe((meeting) => {
      this.meeting = meeting;
      this.meeting.filter(i => i.start_time_set = this.convertTo12Hr(i.start_time));

      const myModalOptions: ModalOptions = {
        enableBackdropDismiss: true,
        showBackdrop: true,
        cssClass: "mymodal"
      };

      const myModal: Modal = this.modal.create(ModalComponent, { data: this.meeting }, myModalOptions);

      myModal.onDidDismiss((data) => {
        //        console.log("I have dismissed.");
        console.log(data);
      });

      myModal.onWillDismiss((data) => {
        //        console.log("I'm about to dismiss");
        console.log(data);
      });

      myModal.present();
    });
  }

  public openMapsLink(destLatitude, destLongitude) {
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

}
