import { Inject, Injectable } from '@angular/core';
import * as data from './config.development.json';

@Injectable()
export class AppConfig {

    private config: any = null;

    constructor() { }

    /**
     * Use to get the data found in the second file (config file)
     */
    public getConfig(key: any) {
        return this.config.default[key];
    }

    /**
     * This method:
     *   a) Loads "env.json" to get the current working environment (e.g.: 'production', 'development')
     *   b) Loads "config.[env].json" to get all env's variables (e.g.: 'config.development.json')
     */
    public load() {
        this.config = data;
    }
        
}