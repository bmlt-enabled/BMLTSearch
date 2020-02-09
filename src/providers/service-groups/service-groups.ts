import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

/*
  Generated class for the ServiceGroupsProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class ServiceGroupsProvider {

  getApiUrlServiceGroups: string = "https://tomato.bmltenabled.org/main_server/client_interface/json/?switcher=GetServiceBodies&callingApp=ionic-android";

  constructor(public http: HttpClient) {
  }

  getAllServiceGroups() {
    return this.http.get(this.getApiUrlServiceGroups);
  }

}
