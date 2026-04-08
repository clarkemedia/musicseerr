import logger from '@server/logger';
import ServarrBase from './base';

export interface LidarrAlbumOptions {
  title: string;
  foreignAlbumId: string;
  qualityProfileId: number;
  metadataProfileId: number;
  rootFolderPath: string;
  tags: number[];
  monitored?: boolean;
  searchNow?: boolean;
  artist: LidarrArtistOptions;
}

export interface LidarrArtistOptions {
  artistName: string;
  foreignArtistId: string;
  qualityProfileId: number;
  metadataProfileId: number;
  rootFolderPath: string;
  tags: number[];
  monitored?: boolean;
  searchNow?: boolean;
}

export interface LidarrArtist {
  id: number;
  status: string;
  artistName: string;
  foreignArtistId: string;
  tadbId: number;
  discogsId: number;
  qualityProfileId: number;
  metadataProfileId: number;
  overview: string;
  artistType: string;
  disambiguation: string;
  rootFolderPath: string;
  path: string;
  cleanName: string;
  sortName: string;
  links: { url: string; name: string }[];
  images: { url: string; coverType: string; remoteUrl?: string }[];
  genres: string[];
  tags: number[];
  added: string;
  monitored: boolean;
  statistics?: {
    albumCount: number;
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
}

export interface LidarrAlbum {
  id: number;
  title: string;
  disambiguation: string;
  overview: string;
  artistId: number;
  foreignAlbumId: string;
  profileId: number;
  duration: number;
  albumType: string;
  secondaryTypes: string[];
  mediumCount: number;
  ratings: { votes: number; value: number };
  releaseDate: string;
  releases: LidarrRelease[];
  genres: string[];
  media: { mediumNumber: number; mediumName: string; mediumFormat: string }[];
  artist: LidarrArtist;
  links: { url: string; name: string }[];
  images: { url: string; coverType: string; remoteUrl?: string }[];
  statistics?: {
    trackFileCount: number;
    trackCount: number;
    totalTrackCount: number;
    sizeOnDisk: number;
    percentOfTracks: number;
  };
  monitored: boolean;
  anyReleaseOk: boolean;
  grabbed: boolean;
  addOptions?: {
    searchForNewAlbum: boolean;
  };
}

export interface LidarrRelease {
  id: number;
  foreignReleaseId: string;
  title: string;
  status: string;
  duration: number;
  trackCount: number;
  media: { mediumNumber: number; mediumName: string; mediumFormat: string }[];
  mediumCount: number;
  disambiguation: string;
  country: string[];
  label: string[];
  format: string;
  monitored: boolean;
}

export interface MetadataProfile {
  id: number;
  name: string;
}

export interface LidarrSearchResult {
  id: number;
  title?: string;
  artistName?: string;
  foreignAlbumId?: string;
  foreignArtistId?: string;
  overview?: string;
  images?: { url: string; coverType: string; remoteUrl?: string }[];
  links?: { url: string; name: string }[];
  genres?: string[];
  albumType?: string;
  artist?: LidarrArtist;
}

class LidarrAPI extends ServarrBase<{ albumId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'lidarr', apiName: 'Lidarr' });
  }

  public getArtists = async (): Promise<LidarrArtist[]> => {
    try {
      const response = await this.axios.get<LidarrArtist[]>('/artist');
      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve artists: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getArtist = async ({ id }: { id: number }): Promise<LidarrArtist> => {
    try {
      const response = await this.axios.get<LidarrArtist>(`/artist/${id}`);
      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve artist: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getArtistByMusicBrainzId = async (
    mbId: string
  ): Promise<LidarrArtist | undefined> => {
    try {
      const artists = await this.getArtists();
      return artists.find((a) => a.foreignArtistId === mbId);
    } catch (e) {
      logger.error('Error retrieving artist by MusicBrainz ID', {
        label: 'Lidarr API',
        errorMessage: e.message,
        mbId,
      });
      return undefined;
    }
  };

  public lookupArtist = async (term: string): Promise<LidarrSearchResult[]> => {
    try {
      const response = await this.axios.get<LidarrSearchResult[]>(
        '/artist/lookup',
        {
          params: { term },
        }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[Lidarr] Failed to lookup artist: ${e.message}`,
        { cause: e }
      );
    }
  };

  public lookupAlbum = async (term: string): Promise<LidarrSearchResult[]> => {
    try {
      const response = await this.axios.get<LidarrSearchResult[]>(
        '/album/lookup',
        {
          params: { term },
        }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[Lidarr] Failed to lookup album: ${e.message}`,
        { cause: e }
      );
    }
  };

  public getAlbums = async (): Promise<LidarrAlbum[]> => {
    try {
      const response = await this.axios.get<LidarrAlbum[]>('/album');
      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve albums: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getAlbum = async ({ id }: { id: number }): Promise<LidarrAlbum> => {
    try {
      const response = await this.axios.get<LidarrAlbum>(`/album/${id}`);
      return response.data;
    } catch (e) {
      throw new Error(`[Lidarr] Failed to retrieve album: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getAlbumByForeignId = async (
    foreignAlbumId: string
  ): Promise<LidarrAlbum | undefined> => {
    try {
      const response = await this.axios.get<LidarrAlbum[]>('/album/lookup', {
        params: {
          term: `lidarr:${foreignAlbumId}`,
        },
      });
      return response.data[0];
    } catch (e) {
      logger.error('Error retrieving album by foreign ID', {
        label: 'Lidarr API',
        errorMessage: e.message,
        foreignAlbumId,
      });
      return undefined;
    }
  };

  public addArtist = async (
    options: LidarrArtistOptions
  ): Promise<LidarrArtist> => {
    try {
      // Check if artist already exists
      const existing = await this.getArtistByMusicBrainzId(
        options.foreignArtistId
      );

      if (existing) {
        if (!existing.monitored) {
          const response = await this.axios.put<LidarrArtist>('/artist', {
            ...existing,
            monitored: options.monitored ?? true,
            qualityProfileId: options.qualityProfileId,
            metadataProfileId: options.metadataProfileId,
            rootFolderPath: options.rootFolderPath,
            tags: Array.from(new Set([...existing.tags, ...options.tags])),
          });

          logger.info(
            'Found existing artist in Lidarr and set it to monitored.',
            {
              label: 'Lidarr',
              artistId: response.data.id,
              artistName: response.data.artistName,
            }
          );

          return response.data;
        }

        logger.info('Artist already exists and is monitored in Lidarr.', {
          label: 'Lidarr',
          artistId: existing.id,
          artistName: existing.artistName,
        });

        return existing;
      }

      const response = await this.axios.post<LidarrArtist>('/artist', {
        artistName: options.artistName,
        foreignArtistId: options.foreignArtistId,
        qualityProfileId: options.qualityProfileId,
        metadataProfileId: options.metadataProfileId,
        rootFolderPath: options.rootFolderPath,
        monitored: options.monitored ?? true,
        tags: options.tags,
        addOptions: {
          monitor: 'none',
          searchForMissingAlbums: false,
        },
      });

      if (response.data.id) {
        logger.info('Lidarr accepted artist request', {
          label: 'Lidarr',
          artistId: response.data.id,
          artistName: response.data.artistName,
        });
      } else {
        throw new Error('Failed to add artist to Lidarr');
      }

      return response.data;
    } catch (e) {
      logger.error('Failed to add artist to Lidarr.', {
        label: 'Lidarr',
        errorMessage: e.message,
        options,
      });
      throw new Error('Failed to add artist to Lidarr', { cause: e });
    }
  };

  public addAlbum = async (
    options: LidarrAlbumOptions
  ): Promise<LidarrAlbum> => {
    try {
      // First ensure the artist exists
      const artist = await this.addArtist(options.artist);

      // Check if album already exists
      const existingAlbum = await this.getAlbumByForeignId(
        options.foreignAlbumId
      );

      if (existingAlbum) {
        if (
          existingAlbum.statistics &&
          existingAlbum.statistics.percentOfTracks === 100
        ) {
          logger.info(
            'Album already exists and is fully available. Skipping add.',
            {
              label: 'Lidarr',
              album: existingAlbum.title,
            }
          );
          return existingAlbum;
        }

        // Album exists but not fully downloaded, monitor it
        if (!existingAlbum.monitored) {
          const response = await this.axios.put<LidarrAlbum>(
            `/album/${existingAlbum.id}`,
            {
              ...existingAlbum,
              monitored: true,
            }
          );

          logger.info('Set existing album to monitored in Lidarr.', {
            label: 'Lidarr',
            albumId: response.data.id,
            albumTitle: response.data.title,
          });

          if (options.searchNow) {
            await this.searchAlbum(response.data.id);
          }

          return response.data;
        }

        if (options.searchNow) {
          await this.searchAlbum(existingAlbum.id);
        }

        return existingAlbum;
      }

      // Album doesn't exist, add it via the album endpoint
      const response = await this.axios.post<LidarrAlbum>('/album', {
        title: options.title,
        foreignAlbumId: options.foreignAlbumId,
        monitored: options.monitored ?? true,
        anyReleaseOk: true,
        artist: {
          foreignArtistId: options.artist.foreignArtistId,
          artistName: options.artist.artistName,
          qualityProfileId: options.qualityProfileId,
          metadataProfileId: options.metadataProfileId,
          rootFolderPath: options.rootFolderPath,
          monitored: true,
          tags: options.tags,
        },
        addOptions: {
          searchForNewAlbum: options.searchNow ?? true,
        },
      });

      if (response.data.id) {
        logger.info('Lidarr accepted album request', {
          label: 'Lidarr',
          albumId: response.data.id,
          albumTitle: response.data.title,
        });
      } else {
        throw new Error('Failed to add album to Lidarr');
      }

      return response.data;
    } catch (e) {
      logger.error('Failed to add album to Lidarr.', {
        label: 'Lidarr',
        errorMessage: e.message,
        options,
        response: e?.response?.data,
      });
      throw new Error('Failed to add album to Lidarr', { cause: e });
    }
  };

  public async searchAlbum(albumId: number): Promise<void> {
    logger.info('Executing album search command', {
      label: 'Lidarr API',
      albumId,
    });

    try {
      await this.runCommand('AlbumSearch', { albumIds: [albumId] });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Lidarr album search.',
        {
          label: 'Lidarr API',
          errorMessage: e.message,
          albumId,
        }
      );
    }
  }

  public async searchArtist(artistId: number): Promise<void> {
    logger.info('Executing artist search command', {
      label: 'Lidarr API',
      artistId,
    });

    try {
      await this.runCommand('ArtistSearch', { artistId });
    } catch (e) {
      logger.error(
        'Something went wrong while executing Lidarr artist search.',
        {
          label: 'Lidarr API',
          errorMessage: e.message,
          artistId,
        }
      );
    }
  }

  public removeAlbum = async (albumId: number): Promise<void> => {
    try {
      await this.axios.delete(`/album/${albumId}`, {
        params: {
          deleteFiles: true,
          addImportExclusion: false,
        },
      });
      logger.info(`[Lidarr] Removed album ${albumId}`);
    } catch (e) {
      throw new Error(`[Lidarr] Failed to remove album: ${e.message}`, {
        cause: e,
      });
    }
  };

  public removeArtist = async (artistId: number): Promise<void> => {
    try {
      await this.axios.delete(`/artist/${artistId}`, {
        params: {
          deleteFiles: true,
          addImportExclusion: false,
        },
      });
      logger.info(`[Lidarr] Removed artist ${artistId}`);
    } catch (e) {
      throw new Error(`[Lidarr] Failed to remove artist: ${e.message}`, {
        cause: e,
      });
    }
  };

  public getMetadataProfiles = async (): Promise<MetadataProfile[]> => {
    try {
      const response =
        await this.axios.get<MetadataProfile[]>('/metadataprofile');
      return response.data;
    } catch (e) {
      throw new Error(
        `[Lidarr] Failed to retrieve metadata profiles: ${e.message}`,
        { cause: e }
      );
    }
  };

  public clearCache = ({
    foreignAlbumId,
    externalId,
  }: {
    foreignAlbumId?: string | null;
    externalId?: number | null;
  }) => {
    if (foreignAlbumId) {
      this.removeCache('/album/lookup', {
        term: `lidarr:${foreignAlbumId}`,
      });
    }
    if (externalId) {
      this.removeCache(`/album/${externalId}`);
    }
  };
}

export default LidarrAPI;
