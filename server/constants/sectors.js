/**
 * server/constants/sectors.js
 *
 * Authoritative constants and validators for the 10 national sectors.
 * Used across categories, departments, and routing resolution.
 */

export const SECTORS = Object.freeze({
  ROADS: {
    key: 'ROADS',
    displayName: 'Roads & Footpaths',
    description: 'Roads, footpaths, bridges, potholes, and road signage maintenance',
  },
  WATER: {
    key: 'WATER',
    displayName: 'Water Supply',
    description: 'Drinking water distribution, pipeline repairs, and water pressure',
  },
  SEWERAGE: {
    key: 'SEWERAGE',
    displayName: 'Sewerage & Drainage',
    description: 'Sewer lines, drainage systems, manholes, and stormwater management',
  },
  STREET_LIGHTING: {
    key: 'STREET_LIGHTING',
    displayName: 'Street Lighting',
    description: 'Streetlights, dark spots, poles, and lighting infrastructure',
  },
  ELECTRICITY: {
    key: 'ELECTRICITY',
    displayName: 'Electricity',
    description: 'Power distribution, high-voltage lines, transformers, and electrical hazards',
  },
  SOLID_WASTE: {
    key: 'SOLID_WASTE',
    displayName: 'Solid Waste & Sanitation',
    description: 'Garbage collection, waste dumping, sanitation, and public toilets',
  },
  PARKS: {
    key: 'PARKS',
    displayName: 'Parks & Horticulture',
    description: 'Public parks, trees, landscaping, and recreational grounds',
  },
  TRAFFIC_ENFORCEMENT: {
    key: 'TRAFFIC_ENFORCEMENT',
    displayName: 'Traffic Enforcement',
    description: 'Traffic police, signals, traffic management, and illegal parking',
  },
  PUBLIC_HEALTH: {
    key: 'PUBLIC_HEALTH',
    displayName: 'Public Health',
    description: 'Disease prevention, food safety, fogging, and civic health hazards',
  },
  ANIMAL: {
    key: 'ANIMAL',
    displayName: 'Animal Control',
    description: 'Stray animals, animal welfare, and veterinary public safety',
  },
  ENFORCEMENT: {
    key: 'ENFORCEMENT',
    displayName: 'Municipal Enforcement',
    description: 'Encroachment, noise pollution, and municipal regulation enforcement',
  },
})

export const SECTOR_KEYS = Object.freeze(Object.keys(SECTORS))

/**
 * Checks whether a key is a valid sector constant.
 * @param {string} key
 * @returns {boolean}
 */
export function isValidSector(key) {
  if (typeof key !== 'string') return false
  return Boolean(SECTORS[key])
}
