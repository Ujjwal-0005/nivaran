import Category from '../models/Category.js'
import Department from '../models/Department.js'

// Get all categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .populate('department', 'name')
      .sort({ name: 1 })

    res.status(200).json({ categories })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ message: 'Server error fetching categories' })
  }
}
