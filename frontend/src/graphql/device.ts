import { gql } from '@apollo/client';

/** The browser making the requests (DAN-30). */
export type ThisDevice = {
  deviceId: string;
  label: string;
  nickname: string | null;
  firstSeenAt: string;
};

const THIS_DEVICE_FIELDS = gql`
  fragment ThisDeviceFields on ThisDevice {
    deviceId
    label
    nickname
    firstSeenAt
  }
`;

export const REGISTER_DEVICE = gql`
  ${THIS_DEVICE_FIELDS}
  mutation RegisterDevice($deviceId: ID!, $label: String!) {
    registerDevice(deviceId: $deviceId, label: $label) {
      ...ThisDeviceFields
    }
  }
`;

export const SET_DEVICE_NICKNAME = gql`
  ${THIS_DEVICE_FIELDS}
  mutation SetDeviceNickname($nickname: String) {
    setDeviceNickname(nickname: $nickname) {
      ...ThisDeviceFields
    }
  }
`;
