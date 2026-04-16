import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import defineMessages from '@app/utils/defineMessages';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
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
});

interface RecentRequest {
  id: number;
  type: string;
  media: {
    id: number;
    musicBrainzId?: string;
    mediaType: string;
    status: number;
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
    status: number;
  };
}

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

  const musicRequests = recentRequests?.results.filter(
    (r) => r.type === 'music'
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/music/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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

      {recentlyAdded && recentlyAdded.results.length > 0 && (
        <div className="mt-4">
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

      {musicRequests && musicRequests.length > 0 && (
        <div className="mt-4">
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
