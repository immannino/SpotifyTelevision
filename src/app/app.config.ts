import { Inject, Injectable } from '@angular/core';
import * as data from './testdata.json';
@Injectable()
export class AppConfig {

    private config: Object = null;
    private env:    Object = null;
    private configPath: string = "../lib/config/config.json";

    constructor() { }

    /**
     * Use to get the data found in the second file (config file)
     */
    public getConfig(key: any) {
        return this.config[key];
    }

    /**
     * Use to get the data found in the first file (env file)
     */
    public getEnv(key: any) {
        return this.env[key];
    }

    /**
     * This method:
     *   a) Loads "env.json" to get the current working environment (e.g.: 'production', 'development')
     *   b) Loads "config.[env].json" to get all env's variables (e.g.: 'config.development.json')
     */
    public load() {
        this.env = data;
    }
        
}