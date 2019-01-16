import { Component, ViewChild } from '@angular/core';
import { LoadingController } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { ToastController } from 'ionic-angular';
import { Geolocation } from '@ionic-native/geolocation';
import {
  GoogleMaps,
  GoogleMap,
  GoogleMapOptions,
  GoogleMapsEvent,
  MarkerCluster,
  Marker,
  ILatLng,
  LatLng,
  VisibleRegion,
  Environment,
  CameraPosition,
  Spherical
} from "@ionic-native/google-maps";
import { MeetingListProvider } from '../../../providers/meeting-list/meeting-list';
import { TranslateService } from '@ngx-translate/core';
import { InAppBrowser } from '@ionic-native/in-app-browser';

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
  markerCluster: MarkerCluster;
  visibleRegion: VisibleRegion;
  markers = [];


  constructor(private MeetingListProvider: MeetingListProvider,
    public loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private storage: Storage,
    private translate: TranslateService,
    private iab: InAppBrowser) {

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad MarkerClusterPage');

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
    Environment.setEnv({
      'API_KEY_FOR_BROWSER_RELEASE': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA',
      'API_KEY_FOR_BROWSER_DEBUG': 'AIzaSyAiowBMk_xPfnzaq7wZzcbyuCDpKqzZkyA'
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

    this.addCluster();

    this.map.on(GoogleMapsEvent.MAP_DRAG_END).subscribe((params: any[]) => {
      console.log("MAP_DRAG_END")
    });

    this.map.on(GoogleMapsEvent.CAMERA_MOVE_END).subscribe((params: any[]) => {
      console.log("CAMERA_MOVE_END");
      this.deleteCluster();

      let cameraPosition: CameraPosition<ILatLng> = params[0];
      this.mapLatitude = cameraPosition.target.lat;
      this.mapLongitude = cameraPosition.target.lng;
      console.log("Latitude   : ", this.mapLatitude);
      console.log("Longitude  : ", this.mapLongitude);

      this.visibleRegion = this.map.getVisibleRegion();

      this.autoRadius = Spherical.computeDistanceBetween(cameraPosition.target, this.visibleRegion.northeast) / 1000;
      console.log("autoRadius : ", this.autoRadius);

      this.getMeetings();
      console.log(JSON.stringify(this.markers, null, 4));
    });
  }

  addCluster() {
    console.log("addCluster");
    this.markerCluster = this.map.addMarkerClusterSync({
      markers: this.markers,
      icons: [
        {
          min: 3,
          max: 9,
          url: "./assets/markercluster/m1.png",
          label: {
            color: "white"
          }
        },
        {
          min: 10,
          max: 50,
          url: "./assets/markercluster/m2.png",
          label: {
            color: "white"
          }
        },
        {
          min: 51,
          max: 100,
          url: "./assets/markercluster/m3.png",
          label: {
            color: "white"
          }
        },
        {
          min: 101,
          max: 500,
          url: "./assets/markercluster/m4.png",
          label: {
            color: "white"
          }
        },
        {
          min: 501,
          url: "./assets/markercluster/m5.png",
          label: {
            color: "white"
          }
        }
      ]
    });

    this.markerCluster.on(GoogleMapsEvent.MARKER_CLICK).subscribe((params) => {
      let marker: Marker = params[1];
      marker.setDisableAutoPan(true);
      marker.setTitle(marker.get("name"));
      marker.setSnippet(marker.get("address"));
      marker.showInfoWindow();
    });
  }

  deleteCluster() {
    this.markerCluster.remove();
  }

  getMeetings() {
    console.log("getMeetings");
    this.translate.get('LOADINGMAP').subscribe(value => { this.presentLoader(value); })

    this.MeetingListProvider.getRadiusMeetings(this.mapLatitude, this.mapLongitude, this.autoRadius).subscribe((data) => {

      if (JSON.stringify(data) == "{}") {  // empty result set!
        this.meetingList = JSON.parse("[]");
      } else {
        this.meetingList = data;
        this.meetingList = this.meetingList.filter(meeting => meeting.latitude = parseFloat(meeting.latitude));
        this.meetingList = this.meetingList.filter(meeting => meeting.longitude = parseFloat(meeting.longitude));
        this.meetingList.filter(i => i.start_time = this.convertTo12Hr(i.start_time));
      }

      this.setLatLngOffsets();

      this.populateMarkers();

      this.addCluster();

      this.dismissLoader();
    });
  }

  populateMarkers() {
    console.log("populateMarkers");
    this.markers = [];
    let i: number;
    for (i = 0; i < this.meetingList.length - 1; i++) {
      console.log("Meeting number : ", i);
      console.log("Lat  : ", this.meetingList[i].latitude);
      console.log("Lng  : ", this.meetingList[i].longitude);
      let meetingLocation = {
        "lat": this.meetingList[i].latitude,
        "lng": this.meetingList[i].longitude
      };
      console.log("MeetingLocation  :", JSON.stringify(meetingLocation));
      if (this.visibleRegion.contains(<LatLng>(meetingLocation))) {
        console.log("Adding this meeting");
        let data = {
          "position": {
            "lat": this.meetingList[i].latitude,
            "lng": this.meetingList[i].longitude
          },
          "name": this.meetingList[i].meeting_name,
          "address": this.meetingList[i].location_street,
          "icon": "assets/markercluster/marker.png"
        };

        console.log(JSON.stringify(data, null, 4));
        this.markers.push(data);
      } else {
        console.log("Not adding this meeting");
      }
    }
  }

  setLatLngOffsets() {
    console.log("setLatLngOffsets");
    var i: any;
    var dist: number = 0;
    for (i = 0; i < this.meetingList.length - 1; i++) {
      if (parseFloat(this.meetingList[i].distance_in_km) > dist) {
        dist = parseFloat(this.meetingList[i].distance_in_km);
      }
      var longOffset: any = 0;
      var latOffset: any = 0;
      var Offset: any = 0.00002;
      // maybe use :- https://github.com/TopicFriends/TopicFriends/commit/d6c61ae976eb1473b314bd804cebacd5106dac37
      while ((this.meetingList[i].longitude == this.meetingList[i + 1].longitude) &&
        (this.meetingList[i].latitude == this.meetingList[i + 1].latitude)) {
        if ((i % 2) === 1) {
          longOffset += Offset;
          this.meetingList[i].longitude = this.meetingList[i].longitude + longOffset;
        } else {
          latOffset += Offset;
          this.meetingList[i].latitude = this.meetingList[i].latitude + latOffset;
        }
        i++;
        if (i == (this.meetingList.length - 1)) {
          longOffset = 0;
          latOffset = 0;
          break;
        }
      } // while

    } // for
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



}
