import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import defineMessages from '@app/utils/defineMessages';
import { MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline';
import type { MediaStatus } from '@server/constants/media';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover', {
  discover: 'Discover Music',
  searchPlaceholder: 'Search for artists, albums...',
  recentRequests: 'Recent Requests',
  recentlyAdded: 'Recently Added',
  searchPrompt: 'Search for your favorite artists and albums to request them.',
  norecentrequests: 'No recent music requests.',
  popularArtists: 'Popular Artists',
  popularAlbums: 'Popular Albums',
  popularTracks: 'Popular Tracks',
  loadingPopular: 'Loading popular music...',
  noPopularData: 'Popular music data is currently unavailable.',
});

interface RecentRequest {
  id: number;
  type: string;
  media: {
    id: number;
    musicBrainzId?: string;
    mediaType: string;
    status: MediaStatus;
  };
  musicBrainzId?: string;
  albumTitle?: string;
  artistName?: string;
  status: number;
  createdAt: string;
}

interface RecentlyAddedAlbum {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  firstReleaseDate: string;
  primaryType: string;
  posterUrl: string | null;
  mediaInfo: {
    id: number;
    status: MediaStatus;
  };
}

interface PopularArtist {
  mbid: string;
  name: string;
  imageUrl: string;
  fanCount: number;
}

interface PopularAlbum {
  mbid: string;
  title: string;
  artistName: string;
  imageUrl: string;
  releaseDate: string;
}

interface PopularTrack {
  title: string;
  artistName: string;
  artistImageUrl: string;
  albumTitle: string;
  albumImageUrl: string;
  duration: number;
}

interface DiscoverPopularData {
  artists: PopularArtist[];
  albums: PopularAlbum[];
  tracks: PopularTrack[];
}

// Format seconds as m:ss
const formatDuration = (seconds: number): string => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Simple shimmer placeholder card
const ShimmerCard = () => (
  <div className="w-36 flex-shrink-0 sm:w-36 md:w-44">
    <div
      className="animate-pulse rounded-xl bg-gray-700"
      style={{ paddingBottom: '150%' }}
    />
    <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-700" />
    <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-gray-700" />
  </div>
);

const TrackShimmer = () => (
  <div className="flex items-center gap-3 rounded-lg px-3 py-2">
    <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-gray-700" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3 w-1/2 animate-pulse rounded bg-gray-700" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-gray-700" />
    </div>
    <div className="h-3 w-8 animate-pulse rounded bg-gray-700" />
  </div>
);

const Discover = () => {
  const intl = useIntl();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: recentRequests } = useSWR<{
    results: RecentRequest[];
  }>('/api/v1/request?filter=all&take=10&sort=modified&skip=0');

  const { data: recentlyAdded } = useSWR<{
    results: RecentlyAddedAlbum[];
  }>('/api/v1/music/discover/recently-added?limit=8');

  const { data: popular, error: popularError } = useSWR<DiscoverPopularData>(
    '/api/v1/music/discover/popular'
  );

  const musicRequests = recentRequests?.results.filter(
    (r) => r.type === 'music'
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/music/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const popularLoading = !popular && !popularError;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.discover)} />
      <div className="flex flex-col items-center px-4 pt-16 pb-12">
        <h1 className="mb-2 text-4xl font-bold text-white">
          {intl.formatMessage(messages.discover)}
        </h1>
        <p className="mb-8 text-gray-400">
          {intl.formatMessage(messages.searchPrompt)}
        </p>
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              className="w-full rounded-full border border-gray-700 bg-gray-800 py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Popular Artists                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6">
        <h2 className="mb-4 text-xl font-bold text-white">
          {intl.formatMessage(messages.popularArtists)}
        </h2>
        {popularError ? (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        ) : popularLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShimmerCard key={i} />
            ))}
          </div>
        ) : popular && popular.artists.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popular.artists.map((artist) => (
              <div key={artist.mbid} className="flex-shrink-0">
                <TitleCard
                  id={artist.mbid}
                  image={artist.imageUrl || undefined}
                  title={artist.name}
                  mediaType="music-artist"
                  canExpand={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Popular Albums                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-white">
          {intl.formatMessage(messages.popularAlbums)}
        </h2>
        {popularError ? (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        ) : popularLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShimmerCard key={i} />
            ))}
          </div>
        ) : popular && popular.albums.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {popular.albums.map((album) => (
              <div key={album.mbid} className="flex-shrink-0">
                <TitleCard
                  id={album.mbid}
                  image={album.imageUrl || undefined}
                  title={album.title}
                  summary={album.artistName ? `by ${album.artistName}` : undefined}
                  year={album.releaseDate}
                  mediaType="music-album"
                  canExpand={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Popular Tracks                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-white">
          {intl.formatMessage(messages.popularTracks)}
        </h2>
        {popularError ? (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        ) : popularLoading ? (
          <div className="divide-y divide-gray-800 rounded-xl border border-gray-700 bg-gray-800/40">
            {Array.from({ length: 10 }).map((_, i) => (
              <TrackShimmer key={i} />
            ))}
          </div>
        ) : popular && popular.tracks.length > 0 ? (
          <div className="divide-y divide-gray-800 rounded-xl border border-gray-700 bg-gray-800/40">
            {popular.tracks.slice(0, 10).map((track, idx) => (
              <div
                key={`${track.title}-${track.artistName}-${idx}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-700/40"
              >
                {/* Track index */}
                <span className="w-5 flex-shrink-0 text-center text-xs tabular-nums text-gray-500">
                  {idx + 1}
                </span>
                {/* Artist avatar */}
                {track.artistImageUrl ? (
                  <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                    <Image
                      src={track.artistImageUrl}
                      alt={track.artistName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-700">
                    <MusicalNoteIcon className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                {/* Track info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {track.artistName}
                    {track.albumTitle ? (
                      <span className="text-gray-600"> · {track.albumTitle}</span>
                    ) : null}
                  </p>
                </div>
                {/* Duration */}
                {track.duration > 0 && (
                  <span className="flex-shrink-0 text-xs tabular-nums text-gray-500">
                    {formatDuration(track.duration)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {intl.formatMessage(messages.noPopularData)}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recently Added                                                       */}
      {/* ------------------------------------------------------------------ */}
      {recentlyAdded && recentlyAdded.results.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-white">
            {intl.formatMessage(messages.recentlyAdded)}
          </h2>
          <ul className="cards-vertical">
            {recentlyAdded.results.map((album) => (
              <li key={album.id}>
                <TitleCard
                  id={album.id}
                  image={album.posterUrl ?? undefined}
                  title={album.title}
                  year={album.firstReleaseDate}
                  summary={album.artistName ? `by ${album.artistName}` : undefined}
                  mediaType="music-album"
                  status={album.mediaInfo.status}
                  canExpand
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Recent Requests                                                      */}
      {/* ------------------------------------------------------------------ */}
      {musicRequests && musicRequests.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-white">
            {intl.formatMessage(messages.recentRequests)}
          </h2>
          <ul className="cards-vertical">
            {musicRequests.map((request) => (
              <li key={request.id}>
                <TitleCard
                  id={request.musicBrainzId ?? request.media.musicBrainzId ?? ''}
                  title={request.albumTitle ?? 'Unknown Album'}
                  summary={request.artistName ? `by ${request.artistName}` : undefined}
                  mediaType="music-album"
                  status={request.media.status}
                  canExpand
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default Discover;
