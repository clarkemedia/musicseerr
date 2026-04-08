import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import { Permission } from '@server/lib/permissions';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import { mutate } from 'swr';

const messages = defineMessages('components.MusicRequestModal', {
  requestadmin: 'This request will be approved automatically.',
  requestSuccess: '<strong>{title}</strong> requested successfully!',
  requestalbumtitle: 'Request Album',
  requesterror: 'Something went wrong while submitting the request.',
  pendingapproval: 'Your request is pending approval.',
  requestCancel: 'Request for <strong>{title}</strong> canceled.',
});

interface MusicAlbumRequestModalProps
  extends React.HTMLAttributes<HTMLDivElement> {
  musicBrainzId: string;
  albumTitle: string;
  artistName: string;
  artistMusicBrainzId: string;
  posterUrl?: string | null;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
}

const MusicAlbumRequestModal = ({
  onCancel,
  onComplete,
  musicBrainzId,
  albumTitle,
  artistName,
  artistMusicBrainzId,
  posterUrl,
  onUpdating,
}: MusicAlbumRequestModalProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { addToast } = useToasts();
  const intl = useIntl();
  const { hasPermission } = useUser();

  useEffect(() => {
    if (onUpdating) {
      onUpdating(isUpdating);
    }
  }, [isUpdating, onUpdating]);

  const sendRequest = useCallback(async () => {
    setIsUpdating(true);

    try {
      const response = await axios.post<MediaRequest>('/api/v1/request', {
        mediaId: 0,
        mediaType: 'music',
        musicBrainzId,
        artistMusicBrainzId,
        artistName,
        albumTitle,
      });
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0');
      mutate('/api/v1/request/count');

      if (response.data) {
        if (onComplete) {
          onComplete(
            hasPermission(Permission.AUTO_APPROVE) ||
              hasPermission(Permission.MANAGE_REQUESTS)
              ? MediaStatus.PROCESSING
              : MediaStatus.PENDING
          );
        }
        addToast(
          <span>
            {intl.formatMessage(messages.requestSuccess, {
              title: albumTitle,
              strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.requesterror), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }, [
    musicBrainzId,
    artistMusicBrainzId,
    artistName,
    albumTitle,
    onComplete,
    addToast,
    intl,
    hasPermission,
  ]);

  return (
    <Modal
      loading={false}
      backgroundClickable
      onCancel={onCancel}
      onOk={sendRequest}
      title={intl.formatMessage(messages.requestalbumtitle)}
      okText={
        isUpdating
          ? intl.formatMessage(messages.requestalbumtitle)
          : intl.formatMessage(messages.requestalbumtitle)
      }
      okDisabled={isUpdating}
      cancelText="Cancel"
      okButtonType="primary"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={albumTitle}
              className="h-28 w-28 rounded-lg object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-gray-700">
              <svg
                className="h-12 w-12 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-white">{albumTitle}</h3>
            <p className="text-gray-400">{artistName}</p>
          </div>
        </div>
        {hasPermission(
          [Permission.AUTO_APPROVE, Permission.MANAGE_REQUESTS],
          { type: 'or' }
        ) && (
          <Alert title={intl.formatMessage(messages.requestadmin)} type="info" />
        )}
      </div>
    </Modal>
  );
};

export default MusicAlbumRequestModal;
