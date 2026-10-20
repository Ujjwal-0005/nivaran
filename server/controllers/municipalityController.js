import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'

import { getBulkCityStatus } from '../utils/cityStatus.js'

// GET /api/municipalities
// Public route: returns only live cities by default with { _id, name, nameLocal, state, type, centroid, defaultZoom }
// If ?include=catalog, returns also not-live cities as { name, state, type, isLive: false } with no ids, no admin data, no reasons.
export const getActiveMunicipalities = async (req, res) => {
  try {
    const includeCatalog = req.query.include === 'catalog'

    // Fetch municipalities
    const query = includeCatalog ? {} : { isActive: true }
    const allMunis = await Municipality.find(query).sort({ state: 1, name: 1 }).lean()

    const statusMap = await getBulkCityStatus(allMunis.map((m) => m._id))

    const result = []
    for (const m of allMunis) {
      const status = statusMap.get(m._id.toString()) || { isLive: false, reasons: ['inactive'] }

      if (status.isLive) {
        result.push({
          _id: m._id,
          name: m.name,
          nameLocal: m.nameLocal || '',
          state: m.state,
          type: m.type,
          centroid: m.centroid,
          defaultZoom: m.defaultZoom ?? 13,
        })
      } else if (includeCatalog) {
        result.push({
          name: m.name,
          state: m.state,
          type: m.type,
          isLive: false,
        })
      }
    }

    res.status(200).json({ municipalities: result })
  } catch (error) {
    console.error('Error fetching municipalities:', error)
    res.status(500).json({ message: 'Server error fetching municipalities' })
  }
}

// GET /api/municipalities/:id/departments
// Public route: returns active departments of an active municipality with minimal fields
export const getMunicipalityDepartments = async (req, res) => {
  try {
    const { id } = req.params

    // Validate municipality exists and is active
    const municipality = await Municipality.findOne({ _id: id, isActive: true })
    if (!municipality) {
      return res.status(404).json({ message: 'Municipality not found or inactive' })
    }

    const departments = await Department.find(
      { municipality: id, isActive: true, isExternal: false },
      '_id name key'
    ).sort({ name: 1 })

    res.status(200).json({ departments })
  } catch (error) {
    console.error('Error fetching departments:', error)
    res.status(500).json({ message: 'Server error fetching departments' })
  }
}

// GET /api/municipalities/resolve?lat=...&lng=...
// Public route: resolves a pin coordinate to the corresponding municipality
export const resolveMunicipality = async (req, res) => {
  try {
    const { lat, lng } = req.query
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'lat and lng query parameters are required' })
    }

    const { resolveCityFromPoint, CoordinateValidationError } = await import('../utils/resolveCityFromPoint.js')
    const resolved = await resolveCityFromPoint({
      lat,
      lng,
      homeMunicipalityId: null,
    })

    if (!resolved || (!resolved.municipality && !resolved.nearestNotLive)) {
      return res.status(400).json({
        message: 'The selected pin location does not fall within any supported municipality boundary.',
      })
    }

    if (!resolved.isLive || !resolved.municipality) {
      return res.status(403).json({
        isLive: false,
        name: resolved.nearestNotLive?.name,
        state: resolved.nearestNotLive?.state,
        message: `${resolved.nearestNotLive?.name || 'This city'} is not live on Nivaran yet`,
      })
    }

    res.status(200).json({
      municipality: {
        _id: resolved.municipality._id,
        name: resolved.municipality.name,
        state: resolved.municipality.state,
        type: resolved.municipality.type,
        isLive: true,
      },
      distanceKm: resolved.distanceKm,
    })
  } catch (error) {
    if (error.name === 'CoordinateValidationError' || error.statusCode === 400) {
      return res.status(400).json({ message: error.message })
    }
    console.error('Error resolving municipality:', error)
    res.status(500).json({ message: 'Server error resolving municipality' })
  }
}
