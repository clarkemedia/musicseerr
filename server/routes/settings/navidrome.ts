import NavidromeAPI from '@server/api/navidrome'
import type { NavidromeSettings } from '@server/lib/settings'
import { getSettings } from '@server/lib/settings'
import logger from '@server/logger'
import { Router } from 'express'

const navidromeRoutes = Router()

navidromeRoutes.get('/', (_req, res) => {
  const settings = getSettings()

  res.status(200).json(settings.navidrome)
})

navidromeRoutes.post('/', async (req, res) => {
  const settings = getSettings()

  const newSettings = req.body as NavidromeSettings
  settings.navidrome = newSettings
  await settings.save()

  return res.status(200).json(settings.navidrome)
})

navidromeRoutes.post('/test', async (req, res, next) => {
  const body = req.body as { url?: string; username?: string; password?: string }

  if (!body.url || !body.username || !body.password) {
    return next({ status: 400, message: 'url, username, and password are required' })
  }

  try {
    const navidrome = new NavidromeAPI(body.url)
    const ok = await navidrome.ping(body.username, body.password)

    if (!ok) {
      return next({ status: 500, message: 'Failed to connect to Navidrome' })
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    logger.error('Failed to test Navidrome connection', {
      label: 'Navidrome',
      message: e.message,
    })

    return next({ status: 500, message: 'Failed to connect to Navidrome' })
  }
})

export default navidromeRoutes
