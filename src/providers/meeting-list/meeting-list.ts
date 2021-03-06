import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable()
export class MeetingListProvider {

  tomatoBMLT: string = "https://tomato.bmltenabled.org/main_server/client_interface/json/";

  constructor(public http: HttpClient) {
  }

  getAutoRadiusMeetings(lat, long, radius) {
    let getAutoRadiusMeetingsURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults&geo_width_km="
      + "-"
      + radius
      + "&long_val="
      + long
      + "&lat_val="
      + lat
      + "&sort_keys=longitude,latitude&callingApp=ionic-bmltapp";
    return this.http.get(getAutoRadiusMeetingsURL);
  }

  getRadiusMeetings(lat, long, radius) {
    let getRadiusMeetingsURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults"
      + "&data_field_key=longitude,latitude,id_bigint"
      + "&geo_width_km="
      + radius
      + "&long_val="
      + long
      + "&lat_val="
      + lat
      + "&sort_keys=longitude,latitude&callingApp=ionic-bmltapp";
    return this.http.get(getRadiusMeetingsURL);
  }

  getAddressMeetings(lat, long, radius) {
    let getAddressMeetingsURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults&geo_width_km="
      + "-"
      + radius
      + "&long_val="
      + long
      + "&lat_val="
      + lat
      + "&sort_keys=longitude,latitude&callingApp=ionic-bmltapp";
    return this.http.get(getAddressMeetingsURL);
  }

  getNearestMeeting(lat, long) {
    let getAddressMeetingsURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults&geo_width_km="
      + "-1"
      + "&long_val="
      + long
      + "&lat_val="
      + lat
      + "&sort_keys=longitude,latitude&callingApp=ionic-bmltapp";
    return this.http.get(getAddressMeetingsURL);
  }

  getMeetingsByAreaProvider(areaID) {
    let getMeetingsByAreaURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults&services="
      + areaID
      + "&sort_keys=weekday_tinyint,start_time&callingApp=ionic-bmltapp";
    return this.http.get(getMeetingsByAreaURL);

  }

  getSingleMeetingByID(id) {
    let getSingleMeetingByIDURL: string = this.tomatoBMLT
      + "?switcher=GetSearchResults&meeting_ids[]="
      + id;
    return this.http.get(getSingleMeetingByIDURL);
  }

}
