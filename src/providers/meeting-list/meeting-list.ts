import { HttpClient  } from '@angular/common/http';
import { Injectable }  from '@angular/core';

@Injectable()
export class MeetingListProvider {

  tomatoBMLT : string = "https://tomato.na-bmlt.org/main_server/client_interface/json/";

  constructor(public http: HttpClient) {
  }

  getAutoRadiusMeetings(lat, long, radius) {
    var getAutoRadiusMeetingsURL : string = this.tomatoBMLT
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
    var getRadiusMeetingsURL : string = this.tomatoBMLT
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
    var getAddressMeetingsURL : string = this.tomatoBMLT
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
    var getAddressMeetingsURL : string = this.tomatoBMLT
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
    var getMeetingsByAreaURL : string = this.tomatoBMLT
                                      + "?switcher=GetSearchResults&services="
                                      + areaID
                                      + "&sort_keys=weekday_tinyint,start_time&callingApp=ionic-bmltapp";
    return this.http.get(getMeetingsByAreaURL);

  }

  getSingleMeetingByID(id){
    var getSingleMeetingByIDURL : string = this.tomatoBMLT
                                        + "?switcher=GetSearchResults&meeting_ids[]="
                                        + id;
    return this.http.get(getSingleMeetingByIDURL);
  }

}
