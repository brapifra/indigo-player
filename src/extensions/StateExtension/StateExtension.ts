import { Instance } from '@src/Instance';
import { Module } from '@src/Module';
import { PlayerError } from '@src/PlayerError';
import { Events, StateChangeEventData } from '@src/types';
import { AdBreakType } from '@src/types';
import produce from 'immer';
import find from 'lodash/find';

interface State {
  ready: boolean;
  videoSessionStarted: boolean;
  waitingForUser: boolean;

  playRequested: boolean;
  playing: boolean;
  paused: boolean;
  buffering: boolean;
  ended: boolean;

  currentTime: number;
  duration: number;

  adBreaks: any;
  adBreak: any;
  adBreakCurrentTime: number;
  ad: any;

  error: PlayerError;

  bufferedPercentage: number;
  volume: number;

  fullscreenSupported: boolean;
  fullscreen: boolean;
  pip: boolean;

  started: boolean;
}

export class StateExtension extends Module {
  public name: string = 'StateExtension';

  private state: State = {
    ready: false,
    videoSessionStarted: false,
    waitingForUser: false,

    playRequested: false,
    playing: false,
    paused: false,
    buffering: false,
    ended: false,

    currentTime: null,
    duration: null,

    adBreaks: [],
    adBreak: null,
    adBreakCurrentTime: null,
    ad: null,

    error: null,

    bufferedPercentage: 0,
    volume: 1,

    fullscreenSupported: false,
    fullscreen: false,
    pip: false,

    started: false,
  };

  constructor(instance: Instance) {
    super(instance);

    const setReady = this.dispatch((draft, data) => {
      draft.ready = true;
      draft.waitingForUser = !instance.canAutoplay();
    }, Events.STATE_READY);
    this.on(Events.READY, setReady);

    const setPlayRequested = this.dispatch(draft => {
      draft.waitingForUser = false;
      draft.playRequested = true;
      draft.paused = false;
      draft.videoSessionStarted = true;
    }, Events.STATE_PLAY_REQUESTED);
    this.on(Events.PLAYER_STATE_PLAY, setPlayRequested);
    this.on(Events.ADBREAK_STATE_PLAY, setPlayRequested);

    const setPlaying = this.dispatch(draft => {
      draft.started = true;
      draft.playing = true;
      draft.playRequested = true;
      draft.buffering = false;
      draft.paused = false;
    }, Events.STATE_PLAYING);
    this.on(Events.PLAYER_STATE_PLAYING, setPlaying);
    this.on(Events.ADBREAK_STATE_PLAYING, setPlaying);

    const setPaused = this.dispatch(draft => {
      draft.playRequested = false;
      draft.playing = false;
      draft.paused = true;
    }, Events.STATE_PAUSED);
    this.on(Events.PLAYER_STATE_PAUSE, () => {
      // If an adbreak plays, we don't care if the media is paused or not.
      if (this.state.adBreak) {
        return;
      }
      setPaused();
    });
    this.on(Events.ADBREAK_STATE_PAUSE, setPaused);

    const setCurrentTime = this.dispatch((draft, data) => {
      draft.currentTime = data.currentTime;
    }, Events.STATE_CURRENTTIME_CHANGE);
    this.on(Events.PLAYER_STATE_TIMEUPDATE, setCurrentTime);

    const setDuraton = this.dispatch((draft, data) => {
      draft.duration = data.duration;
    }, Events.STATE_DURATION_CHANGE);
    this.on(Events.PLAYER_STATE_DURATIONCHANGE, setDuraton);

    const setAdBreakCurrentTime = this.dispatch((draft, data) => {
      draft.adBreakCurrentTime = data.currentTime;
    }, Events.STATE_CURRENTTIME_CHANGE);
    this.on(Events.ADBREAK_STATE_TIMEUPDATE, setAdBreakCurrentTime);

    const setBuffering = this.dispatch(draft => {
      draft.playing = false;
      draft.buffering = true;
    }, Events.STATE_BUFFERING);
    this.on(Events.PLAYER_STATE_WAITING, setBuffering);

    const setAdBreaks = this.dispatch((draft, data) => {
      draft.adBreaks = data.adBreaks;
    }, Events.STATE_ADBREAKS);
    this.on(Events.ADBREAKS, setAdBreaks);

    const setAdBreak = this.dispatch((draft, data) => {
      draft.adBreak = data.adBreak;
    }, Events.STATE_ADBREAK_STARTED);
    this.on(Events.ADBREAK_STARTED, setAdBreak);

    const resetAdBreak = this.dispatch(draft => {
      draft.adBreak = null;
      draft.adBreakCurrentTime = null;
    }, Events.STATE_ADBREAK_ENDED);
    this.on(Events.ADBREAK_ENDED, resetAdBreak);

    const setAd = this.dispatch((draft, data) => {
      draft.ad = data.ad;
    }, Events.STATE_AD_STARTED);
    this.on(Events.AD_STARTED, setAd);

    const resetAd = this.dispatch(draft => {
      draft.ad = null;
    }, Events.STATE_AD_ENDED);
    this.on(Events.AD_ENDED, resetAd);

    const setEnded = this.dispatch(draft => {
      draft.started = false;
      draft.playRequested = false;
      draft.playing = false;
      draft.ended = true;
    }, Events.STATE_ENDED);
    this.on(Events.PLAYER_STATE_ENDED, () => {
      // If the player ended, but we still have a postroll to play, do not set it to ended.
      if (find(this.state.adBreaks, { type: AdBreakType.POSTROLL })) {
        return;
      }

      setEnded();
    });
    this.on(Events.ADBREAK_ENDED, (data: any) => {
      if (data.adBreak.type === AdBreakType.POSTROLL) {
        setEnded();
      }
    });

    const setBufferedPercentage = this.dispatch((draft, data) => {
      draft.bufferedPercentage = data.percentage;
    }, Events.STATE_BUFFERED_CHANGE);
    this.on(Events.PLAYER_STATE_BUFFEREDCHANGE, setBufferedPercentage);

    const setError = this.dispatch((draft, data) => {
      draft.error = data.error;
    }, Events.STATE_ERROR);
    this.on(Events.ERROR, setError);

    const setVolume = this.dispatch((draft, data) => {
      draft.volume = data.volume;
    }, Events.STATE_VOLUME_CHANGE);
    this.on(Events.PLAYER_STATE_VOLUMECHANGE, setVolume);

    const setFullscreenSupported = this.dispatch(draft => {
      draft.fullscreenSupported = true;
    }, Events.STATE_FULLSCREEN_SUPPORTED);
    this.on(Events.FULLSCREEN_SUPPORTED, setFullscreenSupported);

    const setFullscreenChanged = this.dispatch((draft, data) => {
      draft.fullscreen = data.fullscreen;
    }, Events.STATE_FULLSCREEN_CHANGE);
    this.on(Events.FULLSCREEN_CHANGE, setFullscreenChanged);

    const setPipChanged = this.dispatch((draft, data) => {
      draft.pip = data.pip;
    }, Events.STATE_PIP_CHANGE);
    this.on(Events.PIP_CHANGE, setPipChanged);

    this.emit(Events.STATE_CHANGE, {
      state: this.state,
      prevState: null,
    } as StateChangeEventData);
  }

  public dispatch = (fn, emitEvent: Events) => {
    return (data?: any) => {
      const newState = produce(this.state, draft => {
        fn(draft, data);
        return draft;
      });

      if (newState === this.state) {
        return;
      }

      const prevState = this.state;
      this.state = newState;

      // TODO: Remove this, but for now, it's great for debugging!
      // const diff = {};
      // Object.keys(this.state).forEach(key => {
      //   if (this.state[key] !== prevState[key]) {
      //     diff[key] = { from: prevState[key], to: this.state[key] };
      //   }
      // });
      // if (emitEvent !== 'state:currenttime-change') {
      //   console.log(emitEvent, diff);
      // }

      this.emit(emitEvent, {
        state: this.state,
        prevState,
      } as StateChangeEventData);

      this.emit(Events.STATE_CHANGE, {
        state: this.state,
        prevState,
      } as StateChangeEventData);
    };
  };
}
