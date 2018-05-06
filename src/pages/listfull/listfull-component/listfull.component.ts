import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { LoadingController } from 'ionic-angular';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';
import firstBy from 'thenby';
import thenBy from 'thenby';

@Component({
  selector: 'page-listfull',
  templateUrl: 'listfull.html'
})
export class ListfullComponent {


  serviceGroups: any;
  serviceGroupHierarchy: any = [];
  shownGroup = null;

  constructor( private ServiceGroupsProvider : ServiceGroupsProvider,
               private loadingCtrl           : LoadingController) {

    console.log("ListfullComponent constructor : ", this.serviceGroupHierarchy);
    this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData) => {
      this.serviceGroups = serviceGroupData;
      this.serviceGroups.sort(firstBy("parent_id").thenBy("name").thenBy("id"));
      this.serviceGroupHierarchy = this.getServiceHierarchy(this.serviceGroups, 0);
      console.log("Service Group Hierarchy : ", this.serviceGroupHierarchy);

    });
  }

  getServiceHierarchy(flatServiceGroups, parent) {
    var serviceGroupHierarchy = [];
    for (var i in flatServiceGroups) {
      if (flatServiceGroups[i].parent_id == parent) {
        var childServiceGroup = this.getServiceHierarchy(flatServiceGroups, flatServiceGroups[i].id);
        if (childServiceGroup.length) {
          flatServiceGroups[i].childServiceGroup = childServiceGroup;
        }
        serviceGroupHierarchy.push(flatServiceGroups[i]);
      }
    }
    return serviceGroupHierarchy;
  }

  toggleGroup(group) {
    if (this.isGroupShown(group)) {
      this.shownGroup = null;
    } else {
      this.shownGroup = group;
    }
  };

  isGroupShown(group) {
    return this.shownGroup === group;
  };

}
