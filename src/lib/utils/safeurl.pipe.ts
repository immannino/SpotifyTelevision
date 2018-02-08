import { Pipe, PipeTransform } from "@angular/core";
import { SafeResourceUrl, DomSanitizer} from '@angular/platform-browser';

@Pipe({
    name: 'sanitizeUrl',
    pure: false
})

export class SafeUrlPipe implements PipeTransform {
    constructor(private domSanitizer: DomSanitizer) {
    }

    transform(value: string, args?: any): SafeResourceUrl {            
        return this.domSanitizer.bypassSecurityTrustResourceUrl(value);
    }
}