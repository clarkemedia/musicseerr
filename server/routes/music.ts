import MusicBrainz from '@server/api/musicbrainz';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { Router } from 'express';

const musicRoutes = Router();

const createMusicBrainz = () =>
  new MusicBrainz(
    process.env.FANART_API_KEY || undefined,
    process.env.LASTFM_API_KEY || undefined
  );

musicRoutes.get('/search', async (req, res, next) => {
  try {
    const mb = createMusicBrainz();
    const query = req.query.query as string;
    const page = Number(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;
    const type = req.query.type as string | undefined;

    let results;

    if (type === 'artist') {
      results = await mb.searchArtists({ query, limit, offset });
    } else if (type === 'album') {
      results = await mb.searchAlbums({ query, limit, offset });
    } else {
      results = await mb.searchMulti({ query, limit, offset });
    }

    // Fetch cover art for album results concurrently
    const albumResults = results.results.filter(
      (r) => 'title' in r && r.title
    );
    const coverArtPromises = albumResults.map(async (result) => {
      try {
        const coverUrl = await mb.getCoverArt(result.id);
        result.posterUrl = coverUrl;
      } catch {
        // Cover art not available
      }
    });
    // Also fetch artist images concurrently
    const artistResults = results.results.filter(
      (r) => 'name' in r && r.name && !('title' in r && r.title)
    );
    const artistImagePromises = artistResults.map(async (result) => {
      try {
        const images = await mb.getArtistImages(result.id);
        result.posterUrl = images.poster;
      } catch {
        // Artist images not available
      }
    });
    await Promise.all([...coverArtPromises, ...artistImagePromises]);

    // Attach media status info for results that we have in the database
    const musicBrainzIds = results.results.map((r) => r.id);
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

    const resultsWithStatus = results.results.map((result) => {
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
