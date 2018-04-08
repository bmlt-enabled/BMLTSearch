import { Component } from '@angular/core';
import { NavController, Events, MenuController } from 'ionic-angular';

@Component({
	selector: 'page-home',
	templateUrl: 'home.html'
})
export class HomeComponent {
	pages: Array<{title: string, component: any, icon: string, note: string, params?: any}>;
	constructor(
		private navController: NavController,
		private menuController: MenuController,
		private events: Events) {}

	ngOnInit() {
	  	this.pages = [

	    ];

	    this.events.subscribe('navigationEvent',(object) => {
	    	this.menuController.close();
				if (object.component) {
					this.navController.push(object.component, object.params);
				}
		});
	}

	openPage(page) {
		this.navController.push(page.component, page.params);
	}

}
