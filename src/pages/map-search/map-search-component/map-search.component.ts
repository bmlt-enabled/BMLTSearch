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
  ViewController
} from 'ionic-angular';
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { ModalComponent } from "../../modal/modal-component/modal.component";
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


declare const google: any;


@Component({
  templateUrl: 'map-search.html'
})


export class MapSearchComponent {

  timeDisplay: string = "";
  meetingList: any = [];
  loader = null;
  zoom: number = 8;
  mapLatitude: any = 51.899;
  mapLongitude: any = -8.474;

  eagerMapLat;
  eagerMapLng;

  origLocation = { lat: 51.899, lng: -8.474 }
  origZoom = 10;

  targLocation = { lat: 51.899, lng: -8.474 }
  targZoom = 10;

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

      this.mapLatitude = this.eagerMapLat = myLocation.latLng.lat;
      this.mapLongitude = this.eagerMapLng = myLocation.latLng.lng;

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
    this.map.on(GoogleMapsEvent.MAP_DRAG_END).subscribe((params: any[]) => {
      // if (this.mapEventInProgress == false) {
      //   this.mapEventInProgress = true;
      //   this.getMeetings(params);
      // } else {
      //   console.log("not processing second event - MAP_DRAG_END")
      // }
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_END).subscribe((params: any[]) => {
      if (this.mapEventInProgress == false) {
        this.mapEventInProgress = true;

        // if the map has only moved by less than 10%, then we dont get more meetings,
        // those will have been eagerly lodaed earlier
        this.origLocation.lat = this.eagerMapLat;
        this.origLocation.lng = this.eagerMapLng;

        this.targLocation.lat = params[0].target.lat;
        this.targLocation.lng = params[0].target.lng;
        this.targZoom = params[0].zoom;

        let mapMovementDist = Spherical.computeDistanceBetween(this.origLocation, this.targLocation) / 1000;
        let newSearchTriggerDistance = this.autoRadius / 11;

        if ((mapMovementDist > newSearchTriggerDistance) || (this.targZoom < this.origZoom)) {
          this.getMeetings(params);
        } else {
          this.mapEventInProgress = false;
        }
      }
    });

    // Trigger the event
    this.map.animateCamera({
      'target': {
        "lat": this.mapLatitude,
        "lng": this.mapLongitude
      },
      'zoom': 10
    });

  }


  addCluster() {
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
  }

  deleteCluster() {
    this.markers = [];
    this.markers.length = 0;
    this.meetingList = [];
    this.meetingList.length = 0;
    if (typeof this.markerCluster != "undefined") {
      this.markerCluster.remove();
      this.markerCluster.empty();
      this.markerCluster.destroy();
    }
  }

  getMeetings(params) {
    this.translate.get('FINDING_MTGS').subscribe(value => { this.presentLoader(value); })

    this.mapLatitude = params[0].target.lat;
    this.eagerMapLat = this.mapLatitude;

    this.mapLongitude = params[0].target.lng;
    this.eagerMapLng = this.mapLongitude;

    this.origZoom = params[0].zoom;

    this.autoRadius = Spherical.computeDistanceBetween(params[0].target, params[0].farLeft) / 1000;
    // Eagerly load 10% around screen area
    this.autoRadius = this.autoRadius * 1.1;

    this.MeetingListProvider.getRadiusMeetings(this.mapLatitude, this.mapLongitude, this.autoRadius).subscribe((data) => {
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
  }

  populateMarkers() {
    this.markers = [];
    let i: number;
    let areColocated: boolean = false;
    this.visibleRegion = this.map.getVisibleRegion();

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
    this.autocompleteItems = [];
    this.autocomplete.input = item.description;

    // Address -> latitude,longitude
    Geocoder.geocode({
      "address": item.description
    }).then((results: GeocoderResult[]) => {

      // Add a marker
      let marker: Marker = this.map.addMarkerSync({
        'position': results[0].position,
        'title': item.description
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
      });

      myModal.onWillDismiss((data) => {
        //        console.log("I'm about to dismiss");
      });

      myModal.present();
    });
  }

  public openMapsLink(destLatitude, destLongitude) {
    const browser = this.iab.create('https://www.google.com/maps/search/?api=1&query=' + destLatitude + ',' + destLongitude, '_system');
  }

}
