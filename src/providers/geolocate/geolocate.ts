import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

/*
  Generated class for the GeolocateProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class GeolocateProvider {

  googleAPIKey: string = "&key=AIzaSyDg5AKBNjMvoBBlLgXpy-dLxLAcVJYpOq8";
  convertLatLongUrl: string = "https://maps.googleapis.com/maps/api/geocode/json?latlng=";
  convertAddressUrl: string = "https://maps.googleapis.com/maps/api/geocode/json?address=";

  constructor(public http: HttpClient) {
  }

  convertLatLong(lat, long) {
    let url = this.convertLatLongUrl + lat + "," + long + this.googleAPIKey;

    return this.http.get(url);
  }

  convertAddress(address) {
    let url = this.convertAddressUrl + address + this.googleAPIKey;

    return this.http.get(url);
  }
}
