import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import PageTitle from '@app/components/Common/PageTitle';
import LidarrModal from '@app/components/Settings/LidarrModal';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import { MusicalNoteIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import type { LidarrSettings } from '@server/lib/settings';
import axios from 'axios';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.Settings', {
  services: 'Services',
  lidarrsettings: 'Lidarr Settings',
  serviceSettingsDescription:
    'Configure your Lidarr server(s) below. You can connect multiple Lidarr servers, but only one can be marked as default.',
  deleteserverconfirm: 'Are you sure you want to delete this server?',
  ssl: 'SSL',
  default: 'Default',
  default4k: 'Default 4K',
  is4k: '4K',
  address: 'Address',
  activeProfile: 'Active Profile',
  addlidarr: 'Add Lidarr Server',
  noDefaultServer:
    'At least one Lidarr server must be marked as default in order for music requests to be processed.',
  deleteServer: 'Delete Lidarr Server',
});

export interface DVRTestResponse {
  profiles: {
    id: number;
    name: string;
  }[];
  rootFolders: {
    id: number;
    path: string;
  }[];
  tags: {
    id: number;
    label: string;
  }[];
  urlBase?: string;
}

export type RadarrTestResponse = DVRTestResponse;

export type SonarrTestResponse = DVRTestResponse & {
  languageProfiles:
    | {
        id: number;
        name: string;
      }[]
    | null;
};

export type LidarrTestResponse = DVRTestResponse & {
  metadataProfiles: {
    id: number;
    name: string;
  }[];
};

interface ServerInstanceProps {
  name: string;
  isDefault?: boolean;
  is4k?: boolean;
  hostname: string;
  port: number;
  profileName: string;
  isSSL?: boolean;
  externalUrl?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const ServerInstance = ({
  name,
  hostname,
  port,
  profileName,
  is4k = false,
  isDefault = false,
  isSSL = false,
  externalUrl,
  onEdit,
  onDelete,
}: ServerInstanceProps) => {
  const intl = useIntl();
  const internalUrl =
    (isSSL ? 'https://' : 'http://') + hostname + ':' + String(port);
  const serviceUrl = externalUrl ?? internalUrl;

  return (
    <li className="col-span-1 rounded-lg bg-gray-800 shadow ring-1 ring-gray-500">
      <div className="flex w-full items-center justify-between space-x-6 p-6">
        <div className="flex-1 truncate">
          <div className="mb-2 flex items-center space-x-2">
            <h3 className="truncate font-medium leading-5 text-white">
              <a href={serviceUrl} target="_blank" rel="noopener noreferrer"
                className="transition duration-300 hover:text-white hover:underline">
                {name}
              </a>
            </h3>
            {isDefault && <Badge>{intl.formatMessage(messages.default)}</Badge>}
            {isSSL && <Badge badgeType="success">{intl.formatMessage(messages.ssl)}</Badge>}
          </div>
          <p className="mt-1 truncate text-sm leading-5 text-gray-300">
            <span className="mr-2 font-bold">{intl.formatMessage(messages.address)}</span>
            <a href={internalUrl} target="_blank" rel="noopener noreferrer"
              className="transition duration-300 hover:text-white hover:underline">
              {internalUrl}
            </a>
          </p>
          <p className="mt-1 truncate text-sm leading-5 text-gray-300">
            <span className="mr-2 font-bold">{intl.formatMessage(messages.activeProfile)}</span>
            {profileName}
          </p>
        </div>
        <MusicalNoteIcon className="h-10 w-10 flex-shrink-0 text-green-500 opacity-50" />
      </div>
      <div className="border-t border-gray-500">
        <div className="-mt-px flex">
          <div className="flex w-0 flex-1 border-r border-gray-500">
            <button onClick={() => onEdit()}
              className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center rounded-bl-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white">
              <PencilIcon className="mr-2 h-5 w-5" />
              <span>{intl.formatMessage(globalMessages.edit)}</span>
            </button>
          </div>
          <div className="-ml-px flex w-0 flex-1">
            <button onClick={() => onDelete()}
              className="relative inline-flex w-0 flex-1 items-center justify-center rounded-br-lg border border-transparent py-4 text-sm font-medium leading-5 text-gray-200 transition duration-150 ease-in-out hover:text-white">
              <TrashIcon className="mr-2 h-5 w-5" />
              <span>{intl.formatMessage(globalMessages.delete)}</span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};

const SettingsServices = () => {
  const intl = useIntl();
  const {
    data: lidarrData,
    error: lidarrError,
    mutate: revalidateLidarr,
  } = useSWR<LidarrSettings[]>('/api/v1/settings/lidarr');

  const [editLidarrModal, setEditLidarrModal] = useState<{
    open: boolean;
    lidarr: LidarrSettings | null;
  }>({ open: false, lidarr: null });

  const [deleteServerModal, setDeleteServerModal] = useState<{
    open: boolean;
    serverId: number | null;
  }>({ open: false, serverId: null });

  const deleteServer = async () => {
    await axios.delete(`/api/v1/settings/lidarr/${deleteServerModal.serverId}`);
    setDeleteServerModal({ open: false, serverId: null });
    revalidateLidarr();
    mutate('/api/v1/settings/public');
  };

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.services),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.lidarrsettings)}</h3>
        <p className="description">{intl.formatMessage(messages.serviceSettingsDescription)}</p>
      </div>
      {editLidarrModal.open && (
        <LidarrModal
          lidarr={editLidarrModal.lidarr}
          onClose={() => setEditLidarrModal({ open: false, lidarr: null })}
          onSave={() => {
            revalidateLidarr();
            mutate('/api/v1/settings/public');
            setEditLidarrModal({ open: false, lidarr: null });
          }}
        />
      )}
      <Transition
        as={Fragment}
        show={deleteServerModal.open}
        enter="transition-opacity ease-in-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity ease-in-out duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Modal
          onOk={() => deleteServer()}
          okText={intl.formatMessage(globalMessages.delete)}
          okButtonType="danger"
          onCancel={() => setDeleteServerModal({ open: false, serverId: null })}
          title={intl.formatMessage(messages.deleteServer)}
        >
          {intl.formatMessage(messages.deleteserverconfirm)}
        </Modal>
      </Transition>
      <div className="section">
        {!lidarrData && !lidarrError && <LoadingSpinner />}
        {(lidarrData || lidarrError) && (
          <>
            {lidarrData && lidarrData.length > 0 &&
              !lidarrData.some((lidarr) => lidarr.isDefault && !lidarr.is4k) && (
                <Alert title={intl.formatMessage(messages.noDefaultServer)} />
              )}
            <ul className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {(lidarrData ?? []).map((lidarr) => (
                <ServerInstance
                  key={`lidarr-config-${lidarr.id}`}
                  name={lidarr.name}
                  hostname={lidarr.hostname}
                  port={lidarr.port}
                  profileName={lidarr.activeProfileName}
                  isSSL={lidarr.useSsl}
                  isDefault={lidarr.isDefault}
                  is4k={lidarr.is4k}
                  externalUrl={lidarr.externalUrl}
                  onEdit={() => setEditLidarrModal({ open: true, lidarr })}
                  onDelete={() => setDeleteServerModal({ open: true, serverId: lidarr.id })}
                />
              ))}
              <li className="col-span-1 h-32 rounded-lg border-2 border-dashed border-gray-400 shadow sm:h-44">
                <div className="flex h-full w-full items-center justify-center">
                  <Button
                    buttonType="ghost"
                    onClick={() => setEditLidarrModal({ open: true, lidarr: null })}
                  >
                    <PlusIcon />
                    <span>{intl.formatMessage(messages.addlidarr)}</span>
                  </Button>
                </div>
              </li>
            </ul>
          </>
        )}
      </div>
    </>
  );
};

export default SettingsServices;
