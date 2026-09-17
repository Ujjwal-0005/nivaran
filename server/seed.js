import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Department from './models/Department.js'
import Category from './models/Category.js'
import connectDB from './config/db.js'

dotenv.config()

const departments = [
  { name: 'Roads', description: 'Road maintenance and infrastructure' },
  { name: 'Electrical', description: 'Electrical infrastructure and streetlights' },
  { name: 'Water Supply', description: 'Water supply and pipeline maintenance' },
  { name: 'Sewerage', description: 'Sewerage and drainage systems' },
  { name: 'Sanitation', description: 'Waste management and sanitation' },
  { name: 'Parks', description: 'Public parks and green spaces' },
  { name: 'Traffic Police', description: 'Traffic management and signals' },
  { name: 'Municipal Enforcement', description: 'Municipal regulations enforcement' },
  { name: 'Health', description: 'Public health services' },
  { name: 'Animal Husbandry', description: 'Animal control and welfare' },
]

const categories = [
  { name: 'Pothole', department: 'Roads', severityWeight: 7 },
  { name: 'Damaged footpath', department: 'Roads', severityWeight: 4 },
  { name: 'Broken traffic signal', department: 'Traffic Police', severityWeight: 9 },
  { name: 'Missing road signage', department: 'Roads', severityWeight: 5 },
  { name: 'Streetlight not working', department: 'Electrical', severityWeight: 6 },
  { name: 'Exposed electrical wires', department: 'Electrical', severityWeight: 10 },
  { name: 'Water pipeline leak', department: 'Water Supply', severityWeight: 8 },
  { name: 'Low water pressure', department: 'Water Supply', severityWeight: 5 },
  { name: 'Open manhole', department: 'Sewerage', severityWeight: 10 },
  { name: 'Blocked drain', department: 'Sewerage', severityWeight: 6 },
  { name: 'Stagnant water', department: 'Sewerage', severityWeight: 7 },
  { name: 'Garbage overflow', department: 'Sanitation', severityWeight: 6 },
  { name: 'Illegal dumping', department: 'Sanitation', severityWeight: 5 },
  { name: 'Public toilet issue', department: 'Sanitation', severityWeight: 5 },
  { name: 'Fallen tree/branch', department: 'Parks', severityWeight: 7 },
  { name: 'Damaged park equipment', department: 'Parks', severityWeight: 3 },
  { name: 'Encroachment', department: 'Municipal Enforcement', severityWeight: 4 },
  { name: 'Stray animal issue', department: 'Animal Husbandry', severityWeight: 6 },
  { name: 'Noise pollution', department: 'Municipal Enforcement', severityWeight: 3 },
  { name: 'Unauthorized construction', department: 'Municipal Enforcement', severityWeight: 5 },
]

const seedDatabase = async () => {
  try {
    await connectDB()
    
    // Clear existing data
    await Department.deleteMany()
    await Category.deleteMany()
    console.log('Cleared existing data')

    // Create departments
    const createdDepartments = await Department.insertMany(departments)
    console.log(`Created ${createdDepartments.length} departments`)

    // Create categories with department references
    const categoryDocs = categories.map(cat => {
      const dept = createdDepartments.find(d => d.name === cat.department)
      return {
        name: cat.name,
        department: dept._id,
        severityWeight: cat.severityWeight,
      }
    })

    const createdCategories = await Category.insertMany(categoryDocs)
    console.log(`Created ${createdCategories.length} categories`)

    console.log('Database seeded successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding database:', error.message)
    process.exit(1)
  }
}

seedDatabase()
