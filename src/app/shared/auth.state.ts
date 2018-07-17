import { State, Action, StateContext, Selector } from '@ngxs/store';
import { UserData } from '../../lib/service/spotify/spotify.model';

export class SetAuth {
    static readonly type = '[Auth] Set Auth';
    constructor(public authData: UserData) {}
}

@State({
  name: "survey",
  defaults: {
      authData: {

      }
    //   spotifyAuthState: {
    //       userAccessToken: null,
    //       tokenTimeout: null,
    //       tokenType: null,
    //       state: null
    //   }
  }
})
export class SpotifyAuthState {
  @Selector() static _toggleDrinks(state: any) {
    return state.toggleDrinks;
  }

  @Action(SetAuth)
  setAuth(ctx: StateContext<UserData>, action: SetAuth) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      userAccessToken: action.authData.userAccessToken,
      token_type: action.authData.token_type,
      refreshTokenTimeout: action.authData.refreshTokenTimeout,
      state: action.authData.state
    });
  }
}