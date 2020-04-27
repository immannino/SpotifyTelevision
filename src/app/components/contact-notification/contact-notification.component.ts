import {Component, OnInit} from "@angular/core";

@Component({
    selector: 'contact-notify',
    templateUrl: './contact-notification.html',
    styleUrls: [ './contact-notification.css' ]
})
export class ContactNotifyComponent implements OnInit {
    showMessage: boolean = true;
    constructor() {}

    ngOnInit() {}

    hideMessage() {
        this.showMessage = false;
    }
}
