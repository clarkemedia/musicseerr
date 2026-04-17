import MusicBrainz from '@server/api/musicbrainz';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import axios from 'axios';
import { Router } from 'express';

const musicRoutes = Router();

const createMusicBrainz = () =>
  new MusicBrainz(
    process.env.FANART_API_KEY || undefined,
    process.env.LASTFM_API_KEY || undefined
  );

// ---------------------------------------------------------------------------
// Discover popular — in-memory cache (6 hours)
// ---------------------------------------------------------------------------

interface DiscoverPopularArtist {
  mbid: string;
  name: string;
  imageUrl: string;
  fanCount: number;
}

interface DiscoverPopularAlbum {
  mbid: string;
  title: string;
  artistName: string;
  imageUrl: string;
  releaseDate: string;
}

interface DiscoverPopularTrack {
  title: string;
  artistName: string;
  artistImageUrl: string;
  albumTitle: string;
  albumImageUrl: string;
  duration: number;
}

interface DiscoverPopularResult {
  artists: DiscoverPopularArtist[];
  albums: DiscoverPopularAlbum[];
  tracks: DiscoverPopularTrack[];
}

let popularCache: { data: DiscoverPopularResult; fetchedAt: number } | null = null;
const POPULAR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// Run up to `concurrency` tasks at a time, waiting `delayMs` between batches.
async function rateLimitedSettled<T>(
  items: (() => Promise<T>)[],
  concurrency: number,
  delayMs: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((fn) => fn()));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// GET /search
// ---------------------------------------------------------------------------

musicRoutes.get('/search', async (req, res, next) => {
  try {
    const mb = createMusicBrainz();
    const query = req.query.query as string;
    const page = Number(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    // Filter toggles (default off)
    const includeLive = req.query.includeLive === 'true';
    const includeBootlegs = req.query.includeBootlegs === 'true';

    let results;

    if (type === 'artist') {
      results = await mb.searchArtists({ query, limit, offset });
    } else if (type === 'album') {
      results = await mb.searchAlbums({ query, limit, offset });
    } else {
      results = await mb.searchMulti({ query, limit, offset });
    }

    // ------------------------------------------------------------------
    // Filtering — only applies to album results (release groups)
    // ------------------------------------------------------------------
    const filtered = results.results.filter((result) => {
      // Artists have `name` but no `title`; skip filtering them
      if (!('title' in result)) return true;

      const secondaryTypes = (result.secondaryTypes ?? []).map((s) => s.toLowerCase());
      const disambig = (result.disambiguation ?? '').toLowerCase();
      const titleLower = (result.title ?? '').toLowerCase();

      // Always remove Interview / Spokenword
      if (secondaryTypes.includes('interview') || secondaryTypes.includes('spokenword')) {
        return false;
      }

      // Remove live releases unless opted in
      if (!includeLive) {
        if (secondaryTypes.includes('live')) return false;
        if (result.primaryType === 'Broadcast') return false;
      }

      // Remove bootlegs unless opted in
      if (!includeBootlegs) {
        if (secondaryTypes.includes('bootleg')) return false;
        if (disambig.includes('bootleg') || titleLower.includes('bootleg')) return false;
      }

      return true;
    });

    // ------------------------------------------------------------------
    // Smart result ordering
    // ------------------------------------------------------------------
    const artistResults = filtered.filter((r) => 'name' in r && !('title' in r));
    const albumResultsFiltered = filtered.filter((r) => 'title' in r);

    // Determine ordering: if any artist has a high MusicBrainz score (>=85),
    // put artists first (query looks like an artist name).
    const topArtistScore = artistResults.reduce((max, r) => {
      const s = r.score ?? 0;
      return s > max ? s : max;
    }, 0);

    // Sort albums by score descending regardless of ordering
    const sortedAlbums = [...albumResultsFiltered].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );

    let orderedResults: typeof filtered;
    if (topArtistScore >= 85) {
      // Query looks like an artist — artists first, then albums by score desc
      orderedResults = [...artistResults, ...sortedAlbums];
    } else {
      // Query looks like an album/song — albums first by score, then artists
      orderedResults = [...sortedAlbums, ...artistResults];
    }

    // Fetch cover art for album results concurrently
    const albumsToFetch = orderedResults.filter((r) => 'title' in r && r.title);
    const coverArtPromises = albumsToFetch.map(async (result) => {
      try {
        const coverUrl = await mb.getCoverArt(result.id);
        result.posterUrl = coverUrl;
      } catch {
        // Cover art not available
      }
    });
    // Also fetch artist images concurrently
    const artistsToFetch = orderedResults.filter(
      (r) => 'name' in r && r.name && !('title' in r && r.title)
    );
    const artistImagePromises = artistsToFetch.map(async (result) => {
      try {
        const images = await mb.getArtistImages(result.id);
        result.posterUrl = images.poster;
      } catch {
        // Artist images not available
      }
    });
    await Promise.all([...coverArtPromises, ...artistImagePromises]);

    // Attach media status info for results that we have in the database
    const musicBrainzIds = orderedResults.map((r) => r.id);
    const mediaRepository = getRepository(Media);
    const mediaItems = await mediaRepository.find({
      where: musicBrainzIds.map((mbId: string) => ({
        musicBrainzId: mbId,
        mediaType: MediaType.MUSIC,
      })),
    });

    const mediaMap = new Map(
      mediaItems.map((m: Media) => [m.musicBrainzId, m])
    );

    const resultsWithStatus = orderedResults.map((result) => {
      const media = mediaMap.get(result.id);
      return {
        ...result,
        mediaInfo: media
          ? {
              id: media.id,
              status: media.status,
              downloadStatus: media.downloadStatus ?? [],
            }
          : undefined,
      };
    });

    return res.status(200).json({
      page: results.page,
      totalPages: results.totalPages,
      totalResults: results.totalResults,
      results: resultsWithStatus,
    });
  } catch (e) {
    logger.error('Failed to search music', {
      label: 'Music API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve music search results.',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /discover/popular
// ---------------------------------------------------------------------------

musicRoutes.get('/discover/popular', async (req, res, next) => {
  try {
    // Cache hit
    if (popularCache && Date.now() - popularCache.fetchedAt < POPULAR_CACHE_TTL) {
      return res.status(200).json(popularCache.data);
    }

    // Fetch from Deezer (no auth required)
    const [artistsRes, albumsRes, tracksRes] = await Promise.allSettled([
      axios.get<{ data: DeezerArtist[] }>('https://api.deezer.com/chart/0/artists?limit=20'),
      axios.get<{ data: DeezerAlbum[] }>('https://api.deezer.com/chart/0/albums?limit=20'),
      axios.get<{ data: DeezerTrack[] }>('https://api.deezer.com/chart/0/tracks?limit=20'),
    ]);

    const deezerArtists: DeezerArtist[] =
      artistsRes.status === 'fulfilled' ? artistsRes.value.data.data ?? [] : [];
    const deezerAlbums: DeezerAlbum[] =
      albumsRes.status === 'fulfilled' ? albumsRes.value.data.data ?? [] : [];
    const deezerTracks: DeezerTrack[] =
      tracksRes.status === 'fulfilled' ? tracksRes.value.data.data ?? [] : [];

    const mb = createMusicBrainz();

    // Look up MBIDs for artists
    const artistTasks = deezerArtists.map(
      (da) => async (): Promise<DiscoverPopularArtist> => {
        const searchResult = await mb.searchArtists({ query: da.name, limit: 1, offset: 0 });
        const top = searchResult.results[0];
        if (!top || !('name' in top)) throw new Error('No artist match');
        return {
          mbid: top.id,
          name: da.name,
          imageUrl: da.picture_xl ?? da.picture ?? '',
          fanCount: da.nb_fan ?? 0,
        };
      }
    );

    // Look up MBIDs for albums
    const albumTasks = deezerAlbums.map(
      (da) => async (): Promise<DiscoverPopularAlbum> => {
        const albumQuery = `${da.title} artist:${da.artist?.name ?? ''}`;
        const searchResult = await mb.searchAlbums({ query: albumQuery, limit: 1, offset: 0 });
        const top = searchResult.results[0];
        if (!top || !('title' in top)) throw new Error('No album match');
        return {
          mbid: top.id,
          title: da.title,
          artistName: da.artist?.name ?? '',
          imageUrl: da.cover_xl ?? da.cover ?? '',
          releaseDate: da.release_date ?? '',
        };
      }
    );

    const [artistSettled, albumSettled] = await Promise.all([
      rateLimitedSettled(artistTasks, 3, 350),
      rateLimitedSettled(albumTasks, 3, 350),
    ]);

    const artists: DiscoverPopularArtist[] = artistSettled
      .filter((r): r is PromiseFulfilledResult<DiscoverPopularArtist> => r.status === 'fulfilled')
      .map((r) => r.value);

    const albums: DiscoverPopularAlbum[] = albumSettled
      .filter((r): r is PromiseFulfilledResult<DiscoverPopularAlbum> => r.status === 'fulfilled')
      .map((r) => r.value);

    // Tracks — no MBID lookup needed
    const tracks: DiscoverPopularTrack[] = deezerTracks.slice(0, 20).map((dt) => ({
      title: dt.title,
      artistName: dt.artist?.name ?? '',
      artistImageUrl: dt.artist?.picture_medium ?? dt.artist?.picture ?? '',
      albumTitle: dt.album?.title ?? '',
      albumImageUrl: dt.album?.cover_medium ?? dt.album?.cover ?? '',
      duration: dt.duration ?? 0,
    }));

    const data: DiscoverPopularResult = { artists, albums, tracks };

    // Store in cache
    popularCache = { data, fetchedAt: Date.now() };

    return res.status(200).json(data);
  } catch (e) {
    logger.error('Failed to load discover popular', {
      label: 'Music API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve popular music.',
    });
  }
});

// ---------------------------------------------------------------------------
// Deezer response types (local — not exported)
// ---------------------------------------------------------------------------

interface DeezerArtist {
  id: number;
  name: string;
  picture?: string;
  picture_xl?: string;
  nb_fan?: number;
}

interface DeezerAlbum {
  id: number;
  title: string;
  cover?: string;
  cover_xl?: string;
  release_date?: string;
  artist?: { id: number; name: string };
}

interface DeezerTrack {
  id: number;
  title: string;
  duration?: number;
  artist?: { id: number; name: string; picture?: string; picture_medium?: string };
  album?: { id: number; title: string; cover?: string; cover_medium?: string };
}

// ---------------------------------------------------------------------------
// GET /artist/:id
// ---------------------------------------------------------------------------

musicRoutes.get('/artist/:id', async (req, res, next) => {
  try {
    const mb = createMusicBrainz();
    const mediaRepository = getRepository(Media);
    const artist = await mb.getArtist(req.params.id);
    const [images, bio] = await Promise.all([
      mb.getArtistImages(req.params.id),
      mb.getArtistBio(req.params.id),
    ]);

    artist.posterUrl = images.poster;
    artist.fanartUrl = images.fanart;
    if (bio) {
      artist.overview = bio;
    }

    // Get artist's albums
    const albums = await mb.getArtistAlbums(req.params.id, {
      type: 'album',
    });

    // Fetch cover art for albums (batch, don't block on failures)
    const albumsWithArt = await Promise.all(
      albums.map(async (album) => {
        const coverUrl = await mb.getCoverArt(album.id);
        return { ...album, posterUrl: coverUrl };
      })
    );

    // Get media status for this artist's albums
    const albumIds = albums.map((a) => a.id);
    const mediaItems2 = await mediaRepository.find({
      where: albumIds.map((mbId: string) => ({
        musicBrainzId: mbId,
        mediaType: MediaType.MUSIC,
      })),
    });

    const mediaMap = new Map(
      mediaItems2.map((m: Media) => [m.musicBrainzId, m])
    );

    const albumsWithStatus = albumsWithArt.map((album) => {
      const media = mediaMap.get(album.id);
      return {
        ...album,
        mediaInfo: media
          ? {
              id: media.id,
              status: media.status,
            }
          : undefined,
      };
    });

    return res.status(200).json({
      ...artist,
      albums: albumsWithStatus,
    });
  } catch (e) {
    logger.error('Failed to get artist details', {
      label: 'Music API',
      errorMessage: e.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist details.',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /album/:id
// ---------------------------------------------------------------------------

musicRoutes.get('/album/:id', async (req, res, next) => {
  try {
    const mb = createMusicBrainz();
    const mediaRepository = getRepository(Media);
    const album = await mb.getAlbum(req.params.id);
    const coverUrl = await mb.getCoverArt(req.params.id);

    album.posterUrl = coverUrl;

    // Pick the best release to fetch tracks for. Prefer the earliest "Official"
    // release, otherwise fall back to the first release in the list.
    const sortedReleases = [...(album.releases ?? [])].sort((a, b) => {
      if (a.status === 'Official' && b.status !== 'Official') return -1;
      if (b.status === 'Official' && a.status !== 'Official') return 1;
      return (a.date || '9999').localeCompare(b.date || '9999');
    });
    const bestRelease = sortedReleases[0];
    const releaseDetail = bestRelease
      ? await mb.getRelease(bestRelease.id)
      : null;

    // Get artist info
    let artistInfo = null;
    if (album.artistId) {
      try {
        artistInfo = await mb.getArtist(album.artistId);
        const images = await mb.getArtistImages(album.artistId);
        artistInfo.posterUrl = images.poster;
        artistInfo.fanartUrl = images.fanart;
      } catch {
        // Artist info is supplementary, don't fail the whole request
      }
    }

    // Get media status
    const media = await mediaRepository.findOne({
      where: {
        musicBrainzId: req.params.id,
        mediaType: MediaType.MUSIC,
      },
      relations: ['requests'],
    });

    return res.status(200).json({
      ...album,
      artist: artistInfo,
      tracks: releaseDetail?.tracks ?? [],
      bestRelease: releaseDetail
        ? {
            id: releaseDetail.id,
            title: releaseDetail.title,
            date: releaseDetail.date,
            country: releaseDetail.country,
            format: releaseDetail.format,
            trackCount: releaseDetail.trackCount,
          }
        : null,
      mediaInfo: media
        ? {
            id: media.id,
            status: media.status,
            requests: media.requests,
            downloadStatus: media.downloadStatus ?? [],
          }
        : undefined,
    });
  } catch (e) {
    logger.error('Failed to get album details', {
      label: 'Music API',
      errorMessage: e.message,
      albumId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve album details.',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /discover/recently-added
// ---------------------------------------------------------------------------

musicRoutes.get('/discover/recently-added', async (req, res, next) => {
  try {
    const mediaRepository = getRepository(Media);
    // Limit kept small because each item costs a rate-limited MusicBrainz call
    // on first load. Subsequent loads hit the in-memory cache.
    const limit = Math.min(Number(req.query.limit) || 8, 20);

    const recent = await mediaRepository
      .createQueryBuilder('media')
      .where('media.mediaType = :type', { type: MediaType.MUSIC })
      .andWhere('media.musicBrainzId IS NOT NULL')
      .orderBy('media.mediaAddedAt', 'DESC')
      .addOrderBy('media.updatedAt', 'DESC')
      .take(limit)
      .getMany();

    if (recent.length === 0) {
      return res.status(200).json({ results: [] });
    }

    const mb = createMusicBrainz();
    const results = await Promise.all(
      recent.map(async (m) => {
        const id = m.musicBrainzId;
        if (!id) return null;
        try {
          const album = await mb.getAlbum(id);
          const coverUrl = await mb.getCoverArt(id);
          return {
            id,
            title: album.title,
            artistName: album.artistName,
            artistId: album.artistId,
            firstReleaseDate: album.firstReleaseDate,
            primaryType: album.primaryType,
            posterUrl: coverUrl,
            mediaInfo: {
              id: m.id,
              status: m.status,
            },
          };
        } catch {
          return null;
        }
      })
    );

    return res.status(200).json({
      results: results.filter((r) => r !== null),
    });
  } catch (e) {
    logger.error('Failed to load recently added music', {
      label: 'Music API',
      errorMessage: e.message,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve recently added albums.',
    });
  }
});

// ---------------------------------------------------------------------------
// GET /artist/:id/albums
// ---------------------------------------------------------------------------

musicRoutes.get('/artist/:id/albums', async (req, res, next) => {
  try {
    const mb = createMusicBrainz();
    const type = (req.query.type as string) ?? undefined;
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;

    const albums = await mb.getArtistAlbums(req.params.id, {
      type,
      limit,
      offset,
    });

    return res.status(200).json({
      results: albums,
    });
  } catch (e) {
    logger.error('Failed to get artist albums', {
      label: 'Music API',
      errorMessage: e.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist albums.',
    });
  }
});

export default musicRoutes;
