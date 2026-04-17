import { ApiErrorCode } from '@server/constants/error'
import { ApiError } from '@server/types/error'
import axios from 'axios'
import crypto from 'crypto'

export interface NavidromeUser {
  username: string
  email: string
  adminRole: boolean
  id: string
}

interface SubsonicResponse {
  'subsonic-response': {
    status: 'ok' | 'failed'
    version: string
    user?: {
      username: string
      email?: string
      adminRole?: boolean
      id?: string
    }
    error?: {
      code: number
      message: string
    }
  }
}

class NavidromeAPI {
  private baseUrl: string

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private buildAuthParams(
    username: string,
    password: string
  ): Record<string, string> {
    const salt = crypto.randomBytes(8).toString('hex')
    const token = crypto
      .createHash('md5')
      .update(password + salt)
      .digest('hex')

    return {
      u: username,
      t: token,
      s: salt,
      v: '1.16.1',
      c: 'musicseerr',
      f: 'json',
    }
  }

  public async login(
    username: string,
    password: string
  ): Promise<NavidromeUser> {
    const params = this.buildAuthParams(username, password)

    try {
      const response = await axios.get<SubsonicResponse>(
        `${this.baseUrl}/rest/getUser.view`,
        {
          params: {
            ...params,
            username,
          },
          timeout: 10000,
        }
      )

      const subsonicResp = response.data['subsonic-response']

      if (subsonicResp.status !== 'ok') {
        const code = subsonicResp.error?.code ?? 0
        // Subsonic error code 40 = wrong username/password
        if (code === 40 || code === 41) {
          throw new ApiError(401, ApiErrorCode.InvalidCredentials)
        }
        throw new ApiError(500, ApiErrorCode.Unknown)
      }

      const user = subsonicResp.user

      if (!user) {
        throw new ApiError(500, ApiErrorCode.Unknown)
      }

      return {
        username: user.username,
        email: user.email ?? '',
        adminRole: user.adminRole ?? false,
        id: user.id ?? username,
      }
    } catch (e) {
      if (e instanceof ApiError) {
        throw e
      }

      if (e.response?.status === 401 || e.response?.status === 403) {
        throw new ApiError(401, ApiErrorCode.InvalidCredentials)
      }

      if (!e.response) {
        throw new ApiError(404, ApiErrorCode.InvalidUrl)
      }

      throw new ApiError(500, ApiErrorCode.Unknown)
    }
  }

  public async ping(username: string, password: string): Promise<boolean> {
    const params = this.buildAuthParams(username, password)

    try {
      const response = await axios.get<SubsonicResponse>(
        `${this.baseUrl}/rest/ping.view`,
        {
          params,
          timeout: 10000,
        }
      )

      const subsonicResp = response.data['subsonic-response']
      return subsonicResp.status === 'ok'
    } catch {
      return false
    }
  }
}

export default NavidromeAPI
