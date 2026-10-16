import Municipality from '../models/Municipality.js'

// GET /api/municipalities
// Public route: returns active municipalities with minimal public fields
export const getActiveMunicipalities = async (req, res) => {
  try {
    const municipalities = await Municipality.find(
      { isActive: true },
      '_id name nameLocal state type centroid defaultZoom'
    ).sort({ state: 1, name: 1 })

    res.status(200).json({ municipalities })
  } catch (error) {
    console.error('Error fetching municipalities:', error)
    res.status(500).json({ message: 'Server error fetching municipalities' })
  }
}
