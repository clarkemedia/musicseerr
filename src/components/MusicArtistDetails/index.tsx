import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tag from '@app/components/Common/Tag';
import TitleCard from '@app/components/TitleCard';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { MusicalNoteIcon, UserIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MusicArtistDetails', {
  discography: 'Discography',
  genres: 'Genres',
  overviewunavailable: 'No biography available.',
  type: 'Type',
  country: 'Country',
  activeyears: 'Active',
  albums: 'Albums',
  filterAll: 'All',
  filterAlbums: 'Albums',
  filterSingles: 'Singles & EPs',
  filterCompilations: 'Compilations',
  filterLive: 'Live & Other',
});

interface ArtistAlbum {
  id: string;
  title: string;
  primaryType: string;
  firstReleaseDate: string;
  posterUrl: string | null;
  artistName: string;
  mediaInfo?: {
    id: number;
    status: number;
  };
}

interface ArtistData {
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
  albums: ArtistAlbum[];
}

const MusicArtistDetails = () => {
  const router = useRouter();
  const intl = useIntl();

  const { data, error } = useSWR<ArtistData>(
    router.query.artistId
      ? `/api/v1/music/artist/${router.query.artistId}`
      : null
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const artistAttributes: React.ReactNode[] = [];

  if (data.type) {
    artistAttributes.push(data.type);
  }

  if (data.country) {
    artistAttributes.push(data.country);
  }

  if (data.beginYear) {
    const years = data.ended
      ? `${data.beginYear} – ${data.endYear ?? '?'}`
      : `${data.beginYear} – present`;
    artistAttributes.push(years);
  }

  if (data.genres.length) {
    artistAttributes.push(
      data.genres
        .slice(0, 3)
        .map((g, i) => <span key={`genre-${i}`}>{g}</span>)
        .reduce((prev, curr) => (
          <>
            {prev}, {curr}
          </>
        ))
    );
  }

  const [albumFilter, setAlbumFilter] = useState<string>('albums');

  // Sort albums by date descending
  const allAlbums = [...(data.albums ?? [])].sort((a, b) => {
    if (!a.firstReleaseDate) return 1;
    if (!b.firstReleaseDate) return -1;
    return b.firstReleaseDate.localeCompare(a.firstReleaseDate);
  });

  const sortedAlbums = allAlbums.filter((album) => {
    const type = album.primaryType?.toLowerCase() ?? '';
    switch (albumFilter) {
      case 'albums':
        return type === 'album';
      case 'singles':
        return type === 'single' || type === 'ep';
      case 'compilations':
        return type === 'compilation';
      case 'live':
        return type === 'live' || type === 'broadcast' || type === 'demo' ||
          type === 'interview' || type === 'remix' || type === 'soundtrack' ||
          type === 'spokenword' || type === 'audiobook' || type === 'mixtape/street' ||
          type === 'dj-mix' || (type !== 'album' && type !== 'single' && type !== 'ep' && type !== 'compilation' && type !== '');
      default:
        return true;
    }
  });

  return (
    <div className="media-page" style={{ height: 493 }}>
      {data.fanartUrl && (
        <div className="media-page-bg-image">
          <img
            src={data.fanartUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)',
            }}
          />
        </div>
      )}
      <PageTitle title={data.name} />
      <div className="media-header">
        <div className="media-poster">
          {data.posterUrl ? (
            <img
              src={data.posterUrl}
              alt={data.name}
              className="w-full rounded-lg"
              width={600}
              height={600}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-800">
              <UserIcon className="h-24 w-24 text-gray-600" />
            </div>
          )}
        </div>
        <div className="media-title">
          <h1 data-testid="media-title">
            {data.name}
            {data.disambiguation && (
              <span className="ml-2 text-lg font-normal text-gray-400">
                ({data.disambiguation})
              </span>
            )}
          </h1>
          <span className="media-attributes">
            {artistAttributes.length > 0 &&
              artistAttributes
                .map((t, k) => <span key={k}>{t}</span>)
                .reduce((prev, curr) => (
                  <>
                    {prev}
                    <span>|</span>
                    {curr}
                  </>
                ))}
          </span>
        </div>
      </div>
      <div className="media-overview">
        <div className="media-overview-left">
          {data.overview ? (
            <div className="space-y-3">
              {data.overview
                .split(/\n{2,}/)
                .map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {paragraph.trim()}
                  </p>
                ))}
            </div>
          ) : (
            <p className="text-gray-400">
              {intl.formatMessage(messages.overviewunavailable)}
            </p>
          )}

          {/* Discography grid */}
          {allAlbums.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white">
                {intl.formatMessage(messages.discography)}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ['albums', messages.filterAlbums],
                    ['singles', messages.filterSingles],
                    ['compilations', messages.filterCompilations],
                    ['live', messages.filterLive],
                    ['all', messages.filterAll],
                  ] as const
                ).map(([key, msg]) => (
                  <button
                    key={key}
                    onClick={() => setAlbumFilter(key)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      albumFilter === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {intl.formatMessage(msg)}
                  </button>
                ))}
              </div>
              <ul className="cards-vertical mt-4">
                {sortedAlbums.map((album) => (
                  <li key={album.id}>
                    <TitleCard
                      id={album.id}
                      image={album.posterUrl ?? undefined}
                      summary={
                        album.primaryType
                          ? `${album.primaryType}${album.firstReleaseDate ? ` · ${album.firstReleaseDate.slice(0, 4)}` : ''}`
                          : undefined
                      }
                      title={album.title}
                      year={album.firstReleaseDate}
                      mediaType="music-album"
                      status={album.mediaInfo?.status}
                      canExpand
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* External links */}
          {data.links.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xl font-bold text-white">Links</h2>
              <div className="flex flex-wrap gap-2">
                {data.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-white"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="media-overview-right">
          {data.type && (
            <div className="media-fact">
              <span>{intl.formatMessage(messages.type)}</span>
              <span className="media-fact-value">{data.type}</span>
            </div>
          )}
          {data.country && (
            <div className="media-fact">
              <span>{intl.formatMessage(messages.country)}</span>
              <span className="media-fact-value">{data.country}</span>
            </div>
          )}
          {data.beginYear && (
            <div className="media-fact">
              <span>{intl.formatMessage(messages.activeyears)}</span>
              <span className="media-fact-value">
                {data.ended
                  ? `${data.beginYear} – ${data.endYear ?? '?'}`
                  : `${data.beginYear} – present`}
              </span>
            </div>
          )}
          {sortedAlbums.length > 0 && (
            <div className="media-fact">
              <span>{intl.formatMessage(messages.albums)}</span>
              <span className="media-fact-value">{sortedAlbums.length}</span>
            </div>
          )}
          {data.genres.length > 0 && (
            <div className="media-fact">
              <span>{intl.formatMessage(messages.genres)}</span>
              <span className="media-fact-value">
                <div className="flex flex-wrap gap-1.5">
                  {data.genres.map((genre) => (
                    <Tag key={genre}>{genre}</Tag>
                  ))}
                </div>
              </span>
            </div>
          )}
          {data.tags.length > 0 && (
            <div className="media-fact">
              <span>Tags</span>
              <span className="media-fact-value">
                <div className="flex flex-wrap gap-1.5">
                  {data.tags.slice(0, 8).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicArtistDetails;
