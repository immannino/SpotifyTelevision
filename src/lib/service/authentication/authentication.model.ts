export class AuthData {
    clientId: string;
    isAuthed: boolean;

    constructor(clientId: string = "") {
        this.clientId = clientId;
    }
}