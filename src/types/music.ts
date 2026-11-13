export interface LyricLine {
  text: string;
  translation: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  quality: string;
  color: string;
  lyrics: LyricLine[];
  source: "demo" | "local";
  fileName?: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  imported?: boolean;
}

export interface PlayerSettings {
  glass: "frosted" | "liquid";
  motion: boolean;
  weather: boolean;
  panelOpen: boolean;
  quality: string;
  sleep: number;
}

export interface PlayerSnapshot {
  track: Track;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  liked: boolean;
  lyricIndex: number;
}

export type PlayerAction = "toggle" | "next" | "previous" | "like";
