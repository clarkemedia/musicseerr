export interface MusicBrainzArtist {
  id: string;
  name: string;
  sortName: string;
  'sort-name'?: string;
  disambiguation: string;
  type: string;
  country: string;
  beginArea?: {
    id: string;
    name: string;
  };
  lifeSpan?: {
    begin: string;
    end: string | null;
    ended: boolean;
  };
  'life-span'?: {
    begin: string;
    end: string | null;
    ended: boolean;
  };
  tags?: MusicBrainzTag[];
  genres?: MusicBrainzGenre[];
  relations?: MusicBrainzRelation[];
}

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  primaryType: string;
  'primary-type'?: string;
  secondaryTypes?: string[];
  'secondary-types'?: string[];
  firstReleaseDate: string;
  'first-release-date'?: string;
  disambiguation?: string;
  artistCredit?: MusicBrainzArtistCredit[];
  'artist-credit'?: MusicBrainzArtistCredit[];
  tags?: MusicBrainzTag[];
  genres?: MusicBrainzGenre[];
  releases?: MusicBrainzRelease[];
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status: string;
  date: string;
  country: string;
  barcode: string;
  disambiguation?: string;
  packaging?: string;
  quality?: string;
  releaseGroup?: MusicBrainzReleaseGroup;
  media?: MusicBrainzMedia[];
  artistCredit?: MusicBrainzArtistCredit[];
  labelInfo?: {
    catalogNumber: string;
    label: {
      id: string;
      name: string;
    };
  }[];
  coverArtArchive?: {
    artwork: boolean;
    count: number;
    front: boolean;
    back: boolean;
  };
}

export interface MusicBrainzMedia {
  position: number;
  format: string;
  trackCount: number;
  'track-count'?: number;
  tracks?: MusicBrainzTrack[];
}

export interface MusicBrainzTrack {
  id: string;
  number: string;
  title: string;
  length: number;
  position: number;
  recording: {
    id: string;
    title: string;
    length: number;
    disambiguation?: string;
  };
}

export interface MusicBrainzArtistCredit {
  artist: {
    id: string;
    name: string;
    sortName: string;
    disambiguation?: string;
  };
  joinphrase?: string;
}

export interface MusicBrainzTag {
  name: string;
  count: number;
}

export interface MusicBrainzGenre {
  id: string;
  name: string;
  count: number;
  disambiguation?: string;
}

export interface MusicBrainzRelation {
  type: string;
  typeId: string;
  direction: string;
  url?: {
    id: string;
    resource: string;
  };
  target?: string;
}

export interface MusicBrainzSearchResponse<T> {
  created: string;
  count: number;
  offset: number;
  artists?: T[];
  'release-groups'?: T[];
  releases?: T[];
}

// Cover Art Archive interfaces
export interface CoverArtArchiveResponse {
  images: CoverArtImage[];
  release: string;
}

export interface CoverArtImage {
  id: number;
  types: string[];
  front: boolean;
  back: boolean;
  comment: string;
  image: string;
  thumbnails: {
    250: string;
    500: string;
    1200: string;
    small: string;
    large: string;
  };
  approved: boolean;
  edit: number;
}

// Normalised types for internal use (camelCase)
export interface MusicArtistResult {
  id: string;
  name: string;
  sortName: string;
  disambiguation: string;
  type: string;
  country: string;
  genres: string[];
  tags: string[];
  overview: string;
  beginYear: string;
  endYear: string | null;
  ended: boolean;
  posterUrl: string | null;
  fanartUrl: string | null;
  links: { url: string; name: string }[];
}

export interface MusicAlbumResult {
  id: string;
  title: string;
  primaryType: string;
  secondaryTypes: string[];
  firstReleaseDate: string;
  disambiguation: string;
  artistName: string;
  artistId: string;
  genres: string[];
  tags: string[];
  overview: string;
  posterUrl: string | null;
  releases: {
    id: string;
    title: string;
    status: string;
    date: string;
    country: string;
    trackCount: number;
    format: string;
  }[];
}

export interface MusicSearchResults {
  page: number;
  totalPages: number;
  totalResults: number;
  results: (MusicArtistResult | MusicAlbumResult)[];
}
