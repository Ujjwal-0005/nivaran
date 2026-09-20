import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Department from './models/Department.js'
import Category from './models/Category.js'
import User from './models/User.js'
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
  { name: 'Pothole', department: 'Roads', severityWeight: 7, slaHours: 48 },
  { name: 'Damaged footpath', department: 'Roads', severityWeight: 4, slaHours: 72 },
  { name: 'Broken traffic signal', department: 'Traffic Police', severityWeight: 9, slaHours: 12 },
  { name: 'Missing road signage', department: 'Roads', severityWeight: 5, slaHours: 72 },
  { name: 'Streetlight not working', department: 'Electrical', severityWeight: 6, slaHours: 24 },
  { name: 'Exposed electrical wires', department: 'Electrical', severityWeight: 10, slaHours: 6 },
  { name: 'Water pipeline leak', department: 'Water Supply', severityWeight: 8, slaHours: 24 },
  { name: 'Low water pressure', department: 'Water Supply', severityWeight: 5, slaHours: 48 },
  { name: 'Open manhole', department: 'Sewerage', severityWeight: 10, slaHours: 6 },
  { name: 'Blocked drain', department: 'Sewerage', severityWeight: 6, slaHours: 24 },
  { name: 'Stagnant water', department: 'Sewerage', severityWeight: 7, slaHours: 48 },
  { name: 'Garbage overflow', department: 'Sanitation', severityWeight: 6, slaHours: 24 },
  { name: 'Illegal dumping', department: 'Sanitation', severityWeight: 5, slaHours: 48 },
  { name: 'Public toilet issue', department: 'Sanitation', severityWeight: 5, slaHours: 24 },
  { name: 'Fallen tree/branch', department: 'Parks', severityWeight: 7, slaHours: 12 },
  { name: 'Damaged park equipment', department: 'Parks', severityWeight: 3, slaHours: 96 },
  { name: 'Encroachment', department: 'Municipal Enforcement', severityWeight: 4, slaHours: 120 },
  { name: 'Stray animal issue', department: 'Animal Husbandry', severityWeight: 6, slaHours: 48 },
  { name: 'Noise pollution', department: 'Municipal Enforcement', severityWeight: 3, slaHours: 24 },
  { name: 'Unauthorized construction', department: 'Municipal Enforcement', severityWeight: 5, slaHours: 96 },
]

const seedDatabase = async () => {
  try {
    await connectDB()
    
    // Clear existing data
    await Department.deleteMany()
    await Category.deleteMany()
    await User.deleteMany()
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
        slaHours: cat.slaHours,
      }
    })

    const createdCategories = await Category.insertMany(categoryDocs)
    console.log(`Created ${createdCategories.length} categories`)

    // Create staff users for each department
    const staffUsers = []
    for (const dept of createdDepartments) {
      const passwordHash = await bcrypt.hash('staff123', 10)
      const staff = await User.create({
        name: `${dept.name} Staff`,
        email: `${dept.name.toLowerCase().replace(/\s/g, '')}@nivaran.gov`,
        passwordHash,
        role: 'staff',
        department: dept._id,
        isVerified: true,
      })
      staffUsers.push(staff)
      console.log(`Created staff for ${dept.name}: ${staff.email}`)
    }

    // Create an admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10)
    const admin = await User.create({
      name: 'Municipal Admin',
      email: 'admin@nivaran.gov',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isVerified: true,
    })
    console.log(`Created admin: ${admin.email}`)

    console.log('Database seeded successfully!')
    console.log('\n=== Login Credentials ===')
    console.log('Admin: admin@nivaran.gov / admin123')
    staffUsers.forEach(s => {
      console.log(`${s.department.name} Staff: ${s.email} / staff123`)
    })
    process.exit(0)
  } catch (error) {
    console.error('Error seeding database:', error.message)
    process.exit(1)
  }
}

seedDatabase()
