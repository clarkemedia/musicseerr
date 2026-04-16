import MusicBrainz from '@server/api/musicbrainz';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { Router } from 'express';

const musicRoutes = Router();

musicRoutes.get('/search', async (req, res, next) => {
  try {
    const mb = new MusicBrainz();
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
    const mb = new MusicBrainz();
    const mediaRepository = getRepository(Media);
    const artist = await mb.getArtist(req.params.id);
    const images = await mb.getArtistImages(req.params.id);

    artist.posterUrl = images.poster;
    artist.fanartUrl = images.fanart;

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
    const mb = new MusicBrainz();
    const mediaRepository = getRepository(Media);
    const album = await mb.getAlbum(req.params.id);
    const coverUrl = await mb.getCoverArt(req.params.id);

    album.posterUrl = coverUrl;

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

musicRoutes.get('/artist/:id/albums', async (req, res, next) => {
  try {
    const mb = new MusicBrainz();
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
