import {
  Component,
  ViewChild
} from '@angular/core';
import { Storage } from '@ionic/storage';
import {
  LoadingController,
  Platform,
  Modal,
  ModalController,
  ModalOptions,
  ViewController
} from 'ionic-angular';
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
  Environment
} from "@ionic-native/google-maps";
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { TranslateService } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { ModalComponent } from "../../modal/modal-component/modal.component";


declare const google: any;

@Component({
  templateUrl: 'map-search.html'
})

export class MapSearchComponent {

  timeDisplay: string = "";
  meetingList: any = [];
  loader = null;
  zoom: number = 8;
  mapLatitude: number = 51.899;
  mapLongitude: number = -8.754;
  autoRadius: number = 5;
  map: GoogleMap;
  visibleRegion: VisibleRegion;
  marker: Marker;
  markers = [];
  meeting: any;
  ids: string;
  data: any;
  mapEventInProgress: boolean = false;


  constructor(
    private MeetingListProvider: MeetingListProvider,
    public loadingCtrl: LoadingController,
    private platform: Platform,
    private storage: Storage,
    private translate: TranslateService,
    private iab: InAppBrowser,
    private modal: ModalController) {

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

    // This code is necessary for browser
    this.platform.ready().then(() => {
      Environment.setEnv({
        'API_KEY_FOR_BROWSER_RELEASE': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA',
        'API_KEY_FOR_BROWSER_DEBUG': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA'
      });

    });

    let center: ILatLng = { "lat": this.mapLatitude, "lng": this.mapLongitude };

    let options: GoogleMapOptions = {

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
  }

  onMapReady() {
    this.addCluster();
    this.getMeetings();

    this.map.on(GoogleMapsEvent.MAP_DRAG_END).subscribe((params: any[]) => {
      console.log("MAP_DRAG_END")
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_END).subscribe((params: any[]) => {
      if (this.mapEventInProgress == false) {
        this.mapEventInProgress = true;

        console.log("CAMERA_MOVE_END");
        this.deleteCluster();

        let cameraPosition: CameraPosition<ILatLng> = params[0];
        this.mapLatitude = cameraPosition.target.lat;
        this.mapLongitude = cameraPosition.target.lng;

        this.visibleRegion = this.map.getVisibleRegion();

        this.autoRadius = Spherical.computeDistanceBetween(cameraPosition.target, this.visibleRegion.farLeft) / 1000;

        //      this.getMeetings();
      } else {
        console.log("not processing second event")
      }
    });
  }

  addCluster() {
    console.log("addCluster");

    let labelOptions: MarkerLabel = {
      bold: true,
      fontSize: 15,
      color: "white",
      italic: false
    };

    let clusterIcons: MarkerClusterIcon[] = [
      { min: 3, max: 10, url: "./assets/markercluster/m1.png", anchor: { x: 16, y: 16 }, label: labelOptions },
      { min: 11, max: 50, url: "./assets/markercluster/m2.png", anchor: { x: 16, y: 16 }, label: labelOptions },
      { min: 51, max: 100, url: "./assets/markercluster/m3.png", anchor: { x: 24, y: 24 }, label: labelOptions },
      { min: 101, max: 500, url: "./assets/markercluster/m4.png", anchor: { x: 24, y: 24 }, label: labelOptions },
      { min: 501, url: "./assets/markercluster/m5.png", anchor: { x: 32, y: 32 }, label: labelOptions }
    ];

    let options: MarkerClusterOptions = {
      markers: this.markers,
      icons: clusterIcons,
      boundsDraw: false
    };

    let markerCluster: MarkerCluster = this.map.addMarkerClusterSync(options);

    markerCluster.on(GoogleMapsEvent.MARKER_CLICK).subscribe((params) => {
      let marker: Marker = params[1];
      this.openModal(marker.get("ID"));
    });
  }

  deleteCluster() {
    this.markers = [];
    this.markers.length = 0;
    this.meetingList = [];
    this.meetingList.length = 0;
    this.map.clear().then(() => {
      this.getMeetings();
    });
  }

  getMeetings() {
    this.translate.get('LOADINGMAP').subscribe(value => { this.presentLoader(value); })

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
      "icon": "assets/markercluster/MarkerBlue_universal@3x.png"
    };
    this.markers.push(this.data);

  }
  populateMarkers() {
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
                "icon": null
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
              "icon": "assets/markercluster/MarkerRed_universal@3x.png"
            };
            this.markers.push(this.data);
          }
        }
      }
    }
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
        enableBackdropDismiss: false,
        showBackdrop: false
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

}
