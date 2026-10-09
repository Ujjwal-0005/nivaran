import express from 'express'
import Municipality from '../models/Municipality.js'

const router = express.Router()

// GET /api/municipalities - Public list of all available municipalities
router.get('/', async (req, res) => {
  try {
    const municipalities = await Municipality.find().sort({ state: 1, name: 1 })
    res.status(200).json({ municipalities })
  } catch (error) {
    console.error('Error fetching municipalities:', error)
    res.status(500).json({ message: 'Server error fetching municipalities' })
  }
})

export default router
