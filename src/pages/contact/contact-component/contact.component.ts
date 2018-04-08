import { Component } from '@angular/core';
import { Config } from '../../../app/app.config';
import { ServiceGroupsProvider } from '../../../providers/service-groups/service-groups';

import { LoadingController } from 'ionic-angular';

@Component({
  selector: 'page-contact',
  templateUrl: 'contact.html'
})
export class ContactComponent {

  loader = null;
  serviceGroupNames : any;

  constructor(
    private ServiceGroupsProvider : ServiceGroupsProvider,
    public loadingCtrl: LoadingController,
  	private config: Config
  ) {

        this.getServiceGroupContactDetails();
  }


  getServiceGroupContactDetails(){
      this.ServiceGroupsProvider.getAllServiceGroups().subscribe((serviceGroupData)=>{
        this.serviceGroupNames = serviceGroupData;

    });
  }


}
