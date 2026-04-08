import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import Tag from '@app/components/Common/Tag';
import MusicAlbumRequestModal from '@app/components/RequestModal/MusicAlbumRequestModal';
import StatusBadge from '@app/components/StatusBadge';
import { Permission, useUser } from '@app/hooks/useUser';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { MediaStatus } from '@server/constants/media';
import type { DownloadingItem } from '@server/lib/downloadtracker';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.MusicAlbumDetails', {
  tracks: 'Tracks',
  releases: 'Releases',
  genres: 'Genres',
  requestalbum: 'Request Album',
  overviewunavailable: 'Overview unavailable.',
  openinlidarr: 'Open Album in Lidarr',
});

interface AlbumData {
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
  artist?: {
    id: string;
    name: string;
    posterUrl: string | null;
    fanartUrl: string | null;
    type: string;
    country: string;
  };
  mediaInfo?: {
    id: number;
    status: number;
    requests: unknown[];
    downloadStatus: DownloadingItem[];
    serviceUrl?: string;
  };
}

const MusicAlbumDetails = () => {
  const router = useRouter();
  const intl = useIntl();
  const { hasPermission } = useUser();
  const [showRequestModal, setShowRequestModal] = useState(false);

  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<AlbumData>(
    router.query.albumId
      ? `/api/v1/music/album/${router.query.albumId}`
      : null
  );

  const onRequestComplete = useCallback(() => {
    revalidate();
    setShowRequestModal(false);
  }, [revalidate]);

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={404} />;
  }

  const albumAttributes: React.ReactNode[] = [];

  if (data.primaryType) {
    albumAttributes.push(
      <span className="rounded-md border border-gray-500 px-1.5 py-0.5 text-xs">
        {data.primaryType}
      </span>
    );
  }

  if (data.firstReleaseDate) {
    albumAttributes.push(data.firstReleaseDate.slice(0, 4));
  }

  if (data.genres.length) {
    albumAttributes.push(
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

  const bestRelease = data.releases?.[0];
  const trackCount = bestRelease?.trackCount ?? 0;

  return (
    <div className="media-page" style={{ height: 493 }}>
      {data.artist?.fanartUrl && (
        <div className="media-page-bg-image">
          <img
            src={data.artist.fanartUrl}
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
      <PageTitle title={`${data.title} - ${data.artistName}`} />
      {showRequestModal && (
        <MusicAlbumRequestModal
          musicBrainzId={data.id}
          albumTitle={data.title}
          artistName={data.artistName}
          artistMusicBrainzId={data.artistId}
          posterUrl={data.posterUrl}
          onComplete={onRequestComplete}
          onCancel={() => setShowRequestModal(false)}
        />
      )}
      <div className="media-header">
        <div className="media-poster">
          {data.posterUrl ? (
            <img
              src={data.posterUrl}
              alt={data.title}
              className="w-full rounded-lg"
              width={600}
              height={600}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-800">
              <MusicalNoteIcon className="h-24 w-24 text-gray-600" />
            </div>
          )}
        </div>
        <div className="media-title">
          <div className="media-status">
            {data.mediaInfo?.status &&
              data.mediaInfo.status !== MediaStatus.UNKNOWN && (
                <StatusBadge
                  status={data.mediaInfo.status}
                  downloadItem={data.mediaInfo.downloadStatus}
                  title={data.title}
                  inProgress={
                    (data.mediaInfo.downloadStatus ?? []).length > 0
                  }
                  tmdbId={0}
                  mediaType="music"
                  serviceUrl={data.mediaInfo.serviceUrl}
                />
              )}
          </div>
          <h1 data-testid="media-title">
            {data.title}{' '}
            {data.firstReleaseDate && (
              <span className="media-year">
                ({data.firstReleaseDate.slice(0, 4)})
              </span>
            )}
          </h1>
          {data.artistName && (
            <div className="mt-1">
              <Link
                href={`/music/artist/${data.artistId}`}
                className="text-lg text-gray-300 hover:text-white hover:underline"
              >
                {data.artistName}
              </Link>
            </div>
          )}
          <span className="media-attributes">
            {albumAttributes.length > 0 &&
              albumAttributes
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
        <div className="media-actions">
          {(!data.mediaInfo ||
            data.mediaInfo.status === MediaStatus.UNKNOWN) && (
            <Button
              buttonType="primary"
              onClick={() => setShowRequestModal(true)}
            >
              <MusicalNoteIcon />
              <span>{intl.formatMessage(messages.requestalbum)}</span>
            </Button>
          )}
          {data.mediaInfo?.serviceUrl &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <a
                href={data.mediaInfo.serviceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2"
              >
                <Button buttonType="ghost">
                  {intl.formatMessage(messages.openinlidarr)}
                </Button>
              </a>
            )}
        </div>
      </div>
      <div className="media-overview">
        <div className="media-overview-left">
          {data.overview ? (
            <p>{data.overview}</p>
          ) : (
            <p className="text-gray-400">
              {intl.formatMessage(messages.overviewunavailable)}
            </p>
          )}

          {trackCount > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold text-white">
                {intl.formatMessage(messages.tracks)} ({trackCount})
              </h2>
              <div className="mt-2 text-sm text-gray-400">
                {bestRelease.format && (
                  <span>
                    {bestRelease.format}
                    {bestRelease.country && ` · ${bestRelease.country}`}
                    {bestRelease.date && ` · ${bestRelease.date}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {data.releases && data.releases.length > 1 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold text-white">
                {intl.formatMessage(messages.releases)} (
                {data.releases.length})
              </h2>
              <div className="mt-3 space-y-2">
                {data.releases.slice(0, 10).map((release) => (
                  <div
                    key={release.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-2"
                  >
                    <div>
                      <span className="text-white">{release.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      {release.format && <span>{release.format}</span>}
                      {release.country && <span>{release.country}</span>}
                      {release.date && (
                        <span>{release.date.slice(0, 4)}</span>
                      )}
                      {release.trackCount > 0 && (
                        <span>{release.trackCount} tracks</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="media-overview-right">
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
          {data.primaryType && (
            <div className="media-fact">
              <span>Type</span>
              <span className="media-fact-value">{data.primaryType}</span>
            </div>
          )}
          {data.secondaryTypes?.length > 0 && (
            <div className="media-fact">
              <span>Secondary Types</span>
              <span className="media-fact-value">
                {data.secondaryTypes.join(', ')}
              </span>
            </div>
          )}
          {data.firstReleaseDate && (
            <div className="media-fact">
              <span>First Release</span>
              <span className="media-fact-value">
                {data.firstReleaseDate}
              </span>
            </div>
          )}
          {data.disambiguation && (
            <div className="media-fact">
              <span>Note</span>
              <span className="media-fact-value">{data.disambiguation}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicAlbumDetails;
