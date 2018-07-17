import { State, Action, StateContext, Selector } from '@ngxs/store';
import { UserData, SpotifyUserProfile, SimpleSpotifyTrack, SpotifyPlaylistTracks, UserSpotifyPlaylists, SpotifyPlaylistTrack } from '../../lib/service/spotify/spotify.model';

export class SetPlaylists {
    static readonly type = '[Auth] Set Playlists';
    constructor(public playlists: UserSpotifyPlaylists) {}
}
export class SetSinglePlaylist {
    static readonly type = '[Auth] Set Playlist';
    constructor(public playlist: SpotifyPlaylistTracks) {}
}
export class SetPlayingSong {
    static readonly type = '[Auth] Set Song';
    constructor(public song: SpotifyPlaylistTrack) {}
}
export class SetProfile {
    static readonly type = '[Auth] Set Profile';
    constructor(public userProfile: SpotifyUserProfile) {}
}
export class SetTrackIndex {
  static readonly type = '[Auth] Set Track Index';
  constructor(public trackIndex: number) {}
}
export class SetRepeat {
  static readonly type = '[Auth] Set Repeat Flag';
  constructor(public shouldRepeatSongs: boolean) {}
}
export class SetShuffle {
  static readonly type = '[Auth] Set Shuffle Flag';
  constructor(public shouldShuffleSongs: boolean) {}
}
export class SetPlayerStatus {
  static readonly type = '[Auth] Set Player Status';
  constructor(public playerStatus: boolean) {}
}

export class SpotifyDataStateModel {
    spotifyPlaylists: UserSpotifyPlaylists;
    currentSpotifyPlaylistSongs: SpotifyPlaylistTracks;
    currentPlayingSpotifySong: SpotifyPlaylistTrack;
    userProfile: SpotifyUserProfile;
    trackIndex: number;
    shouldRepeatSongs: boolean;
    shouldShuffleSongs: boolean;
    playerStatus: boolean;
}

@State({
  name: "spotifydata",
  defaults: {
    spotifyPlaylists: null,
    currentSpotifyPlaylistSongs: null,
    currentPlayingSpotifySong: null,
    userProfile: null,
    trackIndex: null,
    shouldRepeatSongs: null,
    shouldShuffleSongs: null,
    playerStatus: null
  }
})
export class SpotifyDataState {
  @Selector() static _spotifyPlaylists(state: any) {
    return state.spotifyPlaylists;
  }
  @Selector() static _currentSpotifyPlaylistSongs(state: any) {
    return state.currentSpotifyPlaylistSongs;
  }
  @Selector() static _currentPlayingSpotifySong(state: any) {
    return state.currentPlayingSpotifySong;
  }
  @Selector() static _userProfile(state: any) {
    return state.userProfile;
  }

  @Action(SetTrackIndex)
  setTrackIndex(ctx: StateContext<SpotifyDataStateModel>, action: SetTrackIndex) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      trackIndex: action.trackIndex
    });
  }

  @Action(SetProfile)
  setProfile(ctx: StateContext<SpotifyDataStateModel>, action: SetProfile) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      userProfile: action.userProfile
    });
  }

  @Action(SetPlaylists)
  setPlaylists(ctx: StateContext<SpotifyDataStateModel>, action: SetPlaylists) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      spotifyPlaylists: action.playlists
    });
  }

  @Action(SetSinglePlaylist)
  setSinglePlaylist(ctx: StateContext<SpotifyDataStateModel>, action: SetSinglePlaylist) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      currentSpotifyPlaylistSongs: action.playlist
    });
  }

  @Action(SetPlayingSong)
  setSong(ctx: StateContext<SpotifyDataStateModel>, action: SetPlayingSong) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      currentPlayingSpotifySong: action.song
    });
  }

  @Action(SetRepeat)
  setRepeat(ctx: StateContext<SpotifyDataStateModel>, action: SetRepeat) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      shouldRepeatSongs: action.shouldRepeatSongs
    });
  }

  @Action(SetShuffle)
  setShuffle(ctx: StateContext<SpotifyDataStateModel>, action: SetShuffle) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      shouldShuffleSongs: action.shouldShuffleSongs
    });
  }

  @Action(SetPlayerStatus)
  setPlayerStatus(ctx: StateContext<SpotifyDataStateModel>, action: SetPlayerStatus) {
    const localState = ctx.getState();

    ctx.patchState({
      ...localState,
      playerStatus: action.playerStatus
    })
  }
}