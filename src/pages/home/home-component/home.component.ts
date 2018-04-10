import { Component }           from '@angular/core';
import { NavController,
	       Events,
				 MenuController }      from 'ionic-angular';
import { Geolocation }         from '@ionic-native/geolocation';
import { GeolocateProvider }   from '../../../providers/geolocate/geolocate';
import { Storage }             from '@ionic/storage';

@Component({
	selector: 'page-home',
	templateUrl: 'home.html'
})
export class HomeComponent {

	pages: Array<{title: string, component: any, icon: string, note: string, params?: any}>;

  savedLat         : any;
	savedLng         : any;
	savedAddress     : any;
	goFish           : boolean = false;

	constructor(
		private navController         : NavController,
		private menuController        : MenuController,
		private events                : Events,
		private GeolocateProvider     : GeolocateProvider,
		private geolocation           : Geolocation,
		private storage               : Storage            ) {}

	ngOnInit() {
	  	this.pages = [

	    ];

	    this.events.subscribe('navigationEvent',(object) => {
	    	this.menuController.close();
				if (object.component) {
					this.navController.push(object.component, object.params);
				}
		});

		this.storage.get('savedLat').then(value => {
				if(value) {
					console.log("Latitude was saved previously : ", value);
					this.savedLat = value;
					this.storage.get('savedLng').then(value => {
							if(value) {
								console.log("Longitude was saved previously : ", value);
								this.savedLng = value;
								this.storage.get('savedAddress').then(value => {
										if(value) {
											console.log("Address was saved previously : ", value);
											this.savedLat = value;
										} else {
											console.log("No Address previously saved");
											this.locatePhone();
										}
								});
							} else {
								console.log("No longitude previously saved");
								this.locatePhone();
							}
					});
				} else {
					console.log("No latitude previously saved");
					this.locatePhone();
				}
		});
	}

	openPage(page) {
		this.navController.push(page.component, page.params);
	}

	locatePhone() {
		console.log('Try to get location...');
    this.geolocation.getCurrentPosition({timeout: 10000}).then((resp) => {
      console.log('Got location ok');

      this.savedLat = resp.coords.latitude;
      this.savedLng = resp.coords.longitude;

			this.storage.set('savedLat', this.savedLat);
			this.storage.set('savedLng', this.savedLng);
			
      console.log("Try to getAddressFromLocation");
      this.GeolocateProvider.convertLatLong(this.savedLat, this.savedLng).subscribe((json)=>{
				console.log("Result retrieved from getAddressFromLocation");

        this.savedAddress = json;
        if (this.savedAddress.results[0]) {
					console.log("Address as : ", this.savedAddress.results[0].formatted_address);
          this.savedAddress = this.savedAddress.results[0].formatted_address;
					this.storage.set('savedAddress', this.savedAddress);
        } else {
					console.log("No good address retrieved");
          this.savedAddress = "Location not found";
					this.storage.set('savedAddress', "Location not found");
        }
      });

    }).catch((error) => {
      console.log('Error getting location', error);

    });
  }


}
