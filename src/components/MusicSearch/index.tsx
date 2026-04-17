import Header from '@app/components/Common/Header';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import TitleCard from '@app/components/TitleCard';
import defineMessages from '@app/utils/defineMessages';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { MediaStatus } from '@server/constants/media';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MusicSearch', {
  musicsearch: 'Music Search',
  searchplaceholder: 'Search for artists or albums...',
  noresults: 'No results found.',
  searchresults: 'Search Results',
  filterLive: 'Live',
  filterBootlegs: 'Bootlegs',
});

interface MusicSearchResult {
  id: string;
  title?: string;
  name?: string;
  artistName?: string;
  primaryType?: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  firstReleaseDate?: string;
  posterUrl?: string | null;
  genres?: string[];
  mediaInfo?: {
    id: number;
    status: MediaStatus;
    downloadStatus?: unknown[];
  };
}

interface MusicSearchResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MusicSearchResult[];
}

const MusicSearch = () => {
  const intl = useIntl();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(
    (router.query.query as string) ?? ''
  );
  const [query, setQuery] = useState((router.query.query as string) ?? '');
  const [includeLive, setIncludeLive] = useState(false);
  const [includeBootlegs, setIncludeBootlegs] = useState(false);

  useEffect(() => {
    if (router.query.query) {
      setSearchInput(router.query.query as string);
      setQuery(router.query.query as string);
    }
  }, [router.query.query]);

  const searchUrl = query
    ? `/api/v1/music/search?query=${encodeURIComponent(query)}&includeLive=${includeLive}&includeBootlegs=${includeBootlegs}`
    : null;

  const { data, error, isValidating } = useSWR<MusicSearchResponse>(searchUrl);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchInput.trim()) {
        setQuery(searchInput.trim());
        router.push(
          `/music/search?query=${encodeURIComponent(searchInput.trim())}`,
          undefined,
          { shallow: true }
        );
      }
    },
    [searchInput, router]
  );

  const isLoading = isValidating && !data;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.musicsearch)} />
      <div className="mb-5 mt-1">
        <Header>{intl.formatMessage(messages.musicsearch)}</Header>
      </div>
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={intl.formatMessage(messages.searchplaceholder)}
              className="w-full rounded-lg border border-gray-600 bg-gray-800 py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
            />
          </div>
          {/* Filter toggles */}
          <button
            type="button"
            onClick={() => setIncludeLive((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              includeLive
                ? 'border-green-500 bg-green-600/20 text-green-400'
                : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
            aria-pressed={includeLive}
          >
            {intl.formatMessage(messages.filterLive)}
          </button>
          <button
            type="button"
            onClick={() => setIncludeBootlegs((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              includeBootlegs
                ? 'border-green-500 bg-green-600/20 text-green-400'
                : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
            aria-pressed={includeBootlegs}
          >
            {intl.formatMessage(messages.filterBootlegs)}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-500"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading && <LoadingSpinner />}

      {error && (
        <div className="mt-16 text-center text-xl text-gray-400">
          Something went wrong. Please try again.
        </div>
      )}

      {data && data.results.length === 0 && (
        <div className="mt-16 text-center text-xl text-gray-400">
          {intl.formatMessage(messages.noresults)}
        </div>
      )}

      {data && data.results.length > 0 && (
        <>
          <div className="mb-4">
            <Header>
              {intl.formatMessage(messages.searchresults)} ({data.totalResults})
            </Header>
          </div>
          <ul className="cards-vertical">
            {data.results.map((result) => {
              // Determine if this is an artist or album
              const isArtist = !!result.name && !result.title;
              return (
                <li key={result.id}>
                  <TitleCard
                    id={result.id}
                    image={result.posterUrl ?? undefined}
                    summary={
                      isArtist
                        ? [result.type, result.country, result.disambiguation]
                            .filter(Boolean)
                            .join(' · ')
                        : result.artistName
                          ? `by ${result.artistName}`
                          : undefined
                    }
                    title={isArtist ? result.name! : result.title!}
                    year={result.firstReleaseDate}
                    mediaType={isArtist ? 'music-artist' : 'music-album'}
                    status={result.mediaInfo?.status}
                    canExpand
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!query && (
        <div className="mt-16 text-center text-xl text-gray-400">
          Search for your favorite artists and albums above.
        </div>
      )}
    </>
  );
};

export default MusicSearch;
