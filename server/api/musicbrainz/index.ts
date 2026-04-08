import ExternalAPI from '@server/api/externalapi';
import type { AvailableCacheIds } from '@server/lib/cache';
import cacheManager from '@server/lib/cache';
import logger from '@server/logger';
import type {
  CoverArtArchiveResponse,
  MusicAlbumResult,
  MusicArtistResult,
  MusicBrainzArtist,
  MusicBrainzArtistCredit,
  MusicBrainzReleaseGroup,
  MusicBrainzSearchResponse,
  MusicSearchResults,
} from './interfaces';

const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2';
const COVERART_API_URL = 'https://coverartarchive.org';
const FANART_API_URL = 'https://webservice.fanart.tv/v3/music';

// MusicBrainz rate limit: 1 request per second
const REQUEST_INTERVAL_MS = 1100;

class MusicBrainz extends ExternalAPI {
  private lastRequestTime = 0;
  private fanartApiKey: string | null = null;

  constructor(fanartApiKey?: string) {
    super(
      MUSICBRAINZ_API_URL,
      {},
      {
        nodeCache: cacheManager.getCache(
          'musicbrainz' as AvailableCacheIds
        ).data,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MusicSeerr/1.0.0 (https://github.com/musicseerr)',
        },
      }
    );

    this.fanartApiKey = fanartApiKey ?? null;
  }

  private async rateLimitedRequest<T>(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < REQUEST_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, REQUEST_INTERVAL_MS - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    const response = await this.axios.get<T>(path, {
      params: {
        fmt: 'json',
        ...params,
      },
    });

    return response.data;
  }

  public async searchArtists({
    query,
    limit = 25,
    offset = 0,
  }: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MusicSearchResults> {
    try {
      const data = await this.rateLimitedRequest<
        MusicBrainzSearchResponse<MusicBrainzArtist>
      >('/artist', {
        query,
        limit,
        offset,
      });

      const artists = data.artists ?? [];
      const results: MusicArtistResult[] = await Promise.all(
        artists.map(async (artist) => this.normaliseArtist(artist))
      );

      return {
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil((data.count ?? 0) / limit),
        totalResults: data.count ?? 0,
        results,
      };
    } catch (e) {
      logger.error('Failed to search MusicBrainz artists', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        query,
      });
      throw new Error('Failed to search artists', { cause: e });
    }
  }

  public async searchAlbums({
    query,
    limit = 25,
    offset = 0,
  }: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MusicSearchResults> {
    try {
      const data = await this.rateLimitedRequest<
        MusicBrainzSearchResponse<MusicBrainzReleaseGroup>
      >('/release-group', {
        query,
        limit,
        offset,
      });

      const releaseGroups = data['release-groups'] ?? [];
      const results: MusicAlbumResult[] = releaseGroups.map((rg) =>
        this.normaliseReleaseGroup(rg)
      );

      return {
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil((data.count ?? 0) / limit),
        totalResults: data.count ?? 0,
        results,
      };
    } catch (e) {
      logger.error('Failed to search MusicBrainz release groups', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        query,
      });
      throw new Error('Failed to search albums', { cause: e });
    }
  }

  public async searchMulti({
    query,
    limit = 25,
    offset = 0,
  }: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MusicSearchResults> {
    try {
      const [artistResults, albumResults] = await Promise.all([
        this.searchArtists({ query, limit: Math.ceil(limit / 2), offset }),
        this.searchAlbums({ query, limit: Math.floor(limit / 2), offset }),
      ]);

      // Interleave results: albums first (more likely what people want),
      // then artists
      const combined = [
        ...albumResults.results,
        ...artistResults.results,
      ];

      return {
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.max(
          artistResults.totalPages,
          albumResults.totalPages
        ),
        totalResults: artistResults.totalResults + albumResults.totalResults,
        results: combined.slice(0, limit),
      };
    } catch (e) {
      logger.error('Failed to perform multi-search on MusicBrainz', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        query,
      });
      throw new Error('Failed to search music', { cause: e });
    }
  }

  public async getArtist(mbId: string): Promise<MusicArtistResult> {
    try {
      const data = await this.rateLimitedRequest<MusicBrainzArtist>(
        `/artist/${mbId}`,
        {
          inc: 'genres+tags+url-rels',
        }
      );

      return this.normaliseArtist(data);
    } catch (e) {
      logger.error('Failed to get artist from MusicBrainz', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        mbId,
      });
      throw new Error('Failed to get artist', { cause: e });
    }
  }

  public async getAlbum(mbId: string): Promise<MusicAlbumResult> {
    try {
      const data = await this.rateLimitedRequest<MusicBrainzReleaseGroup>(
        `/release-group/${mbId}`,
        {
          inc: 'artist-credits+genres+tags+releases',
        }
      );

      return this.normaliseReleaseGroup(data);
    } catch (e) {
      logger.error('Failed to get release group from MusicBrainz', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        mbId,
      });
      throw new Error('Failed to get album', { cause: e });
    }
  }

  public async getArtistAlbums(
    artistMbId: string,
    {
      limit = 100,
      offset = 0,
      type,
    }: { limit?: number; offset?: number; type?: string } = {}
  ): Promise<MusicAlbumResult[]> {
    try {
      const params: Record<string, string | number | undefined> = {
        artist: artistMbId,
        limit,
        offset,
        inc: 'artist-credits',
      };

      if (type) {
        params.type = type;
      }

      const data = await this.rateLimitedRequest<
        MusicBrainzSearchResponse<MusicBrainzReleaseGroup>
      >('/release-group', params);

      const releaseGroups = data['release-groups'] ?? [];
      return releaseGroups.map((rg) => this.normaliseReleaseGroup(rg));
    } catch (e) {
      logger.error('Failed to get artist albums from MusicBrainz', {
        label: 'MusicBrainz',
        errorMessage: e.message,
        artistMbId,
      });
      throw new Error('Failed to get artist albums', { cause: e });
    }
  }

  public async getCoverArt(
    releaseGroupId: string
  ): Promise<string | null> {
    try {
      const response = await this.axios.get<CoverArtArchiveResponse>(
        `${COVERART_API_URL}/release-group/${releaseGroupId}`,
        {
          headers: { Accept: 'application/json' },
          timeout: 5000,
        }
      );

      const front = response.data.images?.find((img) => img.front);
      if (front) {
        return front.thumbnails?.['500'] ?? front.thumbnails?.large ?? front.image;
      }

      if (response.data.images?.[0]) {
        return (
          response.data.images[0].thumbnails?.['500'] ??
          response.data.images[0].image
        );
      }

      return null;
    } catch {
      // Cover art not available for every release group
      return null;
    }
  }

  public async getArtistImages(
    artistMbId: string
  ): Promise<{ poster: string | null; fanart: string | null }> {
    if (!this.fanartApiKey) {
      return { poster: null, fanart: null };
    }

    try {
      const response = await this.axios.get<{
        artistthumb?: { url: string }[];
        artistbackground?: { url: string }[];
        hdmusiclogo?: { url: string }[];
      }>(`${FANART_API_URL}/${artistMbId}`, {
        params: { api_key: this.fanartApiKey },
        timeout: 5000,
      });

      return {
        poster: response.data.artistthumb?.[0]?.url ?? null,
        fanart: response.data.artistbackground?.[0]?.url ?? null,
      };
    } catch {
      return { poster: null, fanart: null };
    }
  }

  private normaliseArtist(artist: MusicBrainzArtist): MusicArtistResult {
    const genres = (artist.genres ?? [])
      .sort((a, b) => b.count - a.count)
      .map((g) => g.name);

    const tags = (artist.tags ?? [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((t) => t.name);

    const links = (artist.relations ?? [])
      .filter((r) => r.url?.resource)
      .map((r) => ({
        url: r.url!.resource,
        name: r.type,
      }));

    return {
      id: artist.id,
      name: artist.name,
      sortName: artist['sort-name'] ?? artist.sortName ?? artist.name,
      disambiguation: artist.disambiguation ?? '',
      type: artist.type ?? 'Unknown',
      country: artist.country ?? '',
      genres,
      tags,
      overview: '', // MusicBrainz doesn't have bios, would need last.fm or similar
      beginYear: artist['life-span']?.begin ?? artist.lifeSpan?.begin ?? '',
      endYear: artist['life-span']?.end ?? artist.lifeSpan?.end ?? null,
      ended: artist['life-span']?.ended ?? artist.lifeSpan?.ended ?? false,
      posterUrl: null, // Populated separately via fanart.tv
      fanartUrl: null,
      links,
    };
  }

  private normaliseReleaseGroup(
    rg: MusicBrainzReleaseGroup
  ): MusicAlbumResult {
    const artistCredit = rg['artist-credit'] ?? rg.artistCredit ?? [];
    const artistName = artistCredit
      .map((ac: MusicBrainzArtistCredit) => `${ac.artist.name}${ac.joinphrase ?? ''}`)
      .join('');
    const artistId = artistCredit[0]?.artist?.id ?? '';

    const genres = (rg.genres ?? [])
      .sort((a, b) => b.count - a.count)
      .map((g) => g.name);

    const tags = (rg.tags ?? [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((t) => t.name);

    const releases = (rg.releases ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status ?? '',
      date: r.date ?? '',
      country: r.country ?? '',
      trackCount: r.media?.reduce((sum, m) => sum + (m['track-count'] ?? m.trackCount ?? 0), 0) ?? 0,
      format: r.media?.[0]?.format ?? '',
    }));

    return {
      id: rg.id,
      title: rg.title,
      primaryType: rg['primary-type'] ?? rg.primaryType ?? '',
      secondaryTypes: rg['secondary-types'] ?? rg.secondaryTypes ?? [],
      firstReleaseDate: rg['first-release-date'] ?? rg.firstReleaseDate ?? '',
      disambiguation: rg.disambiguation ?? '',
      artistName,
      artistId,
      genres,
      tags,
      overview: '', // MusicBrainz doesn't have album descriptions
      posterUrl: null, // Populated separately via Cover Art Archive
      releases,
    };
  }
}

export default MusicBrainz;
