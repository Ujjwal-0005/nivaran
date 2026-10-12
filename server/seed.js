import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Department from './models/Department.js'
import Category from './models/Category.js'
import User from './models/User.js'
import Report from './models/Report.js'
import connectDB from './config/db.js'

dotenv.config()

// Seeded random generator for reproducible reports
class SeededRandom {
  constructor(seed) {
    this.seed = seed
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  choice(arr) {
    return arr[this.nextInt(0, arr.length - 1)]
  }
}

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
]

const seedDatabase = async () => {
  try {
    await connectDB()

    console.log('=== Seeding Departments ===')
    let deptCount = 0
    for (const dept of departments) {
      const existing = await Department.findOne({ name: dept.name })
      if (!existing) {
        await Department.create(dept)
        console.log(`  Created department: ${dept.name}`)
        deptCount++
      } else {
        console.log(`  Department already exists: ${dept.name}`)
      }
    }
    console.log(`Departments: ${deptCount} created`)

    const allDepartments = await Department.find()
    const deptMap = new Map(allDepartments.map(d => [d.name, d._id]))

    console.log('\n=== Seeding Categories ===')
    let catCount = 0
    for (const cat of categories) {
      const existing = await Category.findOne({ name: cat.name })
      if (!existing) {
        const deptId = deptMap.get(cat.department)
        await Category.create({
          name: cat.name,
          department: deptId,
          severityWeight: cat.severityWeight,
          slaHours: cat.slaHours,
        })
        console.log(`  Created category: ${cat.name}`)
        catCount++
      } else {
        console.log(`  Category already exists: ${cat.name}`)
      }
    }
    console.log(`Categories: ${catCount} created`)

    const allCategories = await Category.find().populate('department')

    console.log('\n=== Seeding Demo Accounts ===')
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@nivaran.gov'
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123'
    const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Demo@123'

    let userCount = 0

    // Admin
    const existingAdmin = await User.findOne({ email: adminEmail })
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      await User.create({
        name: 'Municipal Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        isVerified: true,
      })
      console.log(`  Created admin: ${adminEmail}`)
      userCount++
    } else {
      console.log(`  Admin already exists: ${adminEmail}`)
    }

    // Staff for Roads, Water Supply, Sanitation
    const staffDepts = ['Roads', 'Water Supply', 'Sanitation']
    const staffUsers = []
    for (const deptName of staffDepts) {
      const email = `${deptName.toLowerCase().replace(/\s/g, '')}@nivaran.gov`
      const existing = await User.findOne({ email })
      if (!existing) {
        const passwordHash = await bcrypt.hash(demoPassword, 10)
        const deptId = deptMap.get(deptName)
        const staff = await User.create({
          name: `${deptName} Staff`,
          email,
          passwordHash,
          role: 'staff',
          department: deptId,
          isVerified: true,
        })
        staffUsers.push(staff)
        console.log(`  Created staff: ${email}`)
        userCount++
      } else {
        console.log(`  Staff already exists: ${email}`)
        staffUsers.push(existing)
      }
    }

    // Citizens
    const citizenEmails = ['citizen1@example.com', 'citizen2@example.com']
    for (let i = 0; i < citizenEmails.length; i++) {
      const existing = await User.findOne({ email: citizenEmails[i] })
      if (!existing) {
        const passwordHash = await bcrypt.hash(demoPassword, 10)
        await User.create({
          name: `Citizen ${i + 1}`,
          email: citizenEmails[i],
          passwordHash,
          role: 'citizen',
          isVerified: true,
        })
        console.log(`  Created citizen: ${citizenEmails[i]}`)
        userCount++
      } else {
        console.log(`  Citizen already exists: ${citizenEmails[i]}`)
      }
    }
    console.log(`Users: ${userCount} created`)

    console.log('\n=== Seeding Sample Reports ===')
    const centerLat = parseFloat(process.env.SEED_CENTER_LAT) || 28.6139
    const centerLng = parseFloat(process.env.SEED_CENTER_LNG) || 77.2090
    const rng = new SeededRandom(42)
    const statuses = ['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed']
    
    let reportCount = 0
    const citizens = await User.find({ role: 'citizen' })
    const staff = await User.find({ role: 'staff' })

    // Generate 15 reports
    for (let i = 0; i < 15; i++) {
      const category = rng.choice(allCategories)
      const citizen = rng.choice(citizens)
      const status = rng.choice(statuses)
      
      // Random offset from center (within ~500m)
      const latOffset = (rng.next() - 0.5) * 0.009
      const lngOffset = (rng.next() - 0.5) * 0.009
      
      const ticketId = `TICKET-${String(i + 1).padStart(4, '0')}`
      const existing = await Report.findOne({ ticketId })
      if (existing) {
        console.log(`  Report already exists: ${ticketId}`)
        continue
      }

      const reportData = {
        ticketId,
        citizen: citizen._id,
        category: category._id,
        department: category.department._id,
        description: `Sample report for ${category.name} at location ${i + 1}`,
        photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
        location: {
          lat: centerLat + latOffset,
          lng: centerLng + lngOffset,
        },
        status,
        isAnonymous: false,
        reportCount: 1,
        reportedBy: [citizen._id],
        priorityScore: 0,
      }

      // Add status-specific fields
      if (status === 'resolved') {
        reportData.resolutionPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/resolved.jpg'
        reportData.resolutionNote = 'Issue has been resolved by maintenance team'
        reportData.resolvedAt = new Date(Date.now() - rng.nextInt(1, 7) * 24 * 60 * 60 * 1000)
      }

      if (status === 'disputed') {
        reportData.isDisputed = true
        reportData.disputeReason = 'Citizen disagrees with resolution'
      }

      // Assign staff for acknowledged/in_progress/resolved
      if (['acknowledged', 'in_progress', 'resolved'].includes(status)) {
        const deptStaff = staff.find(s => s.department && s.department.toString() === category.department._id.toString())
        if (deptStaff) {
          reportData.assignedTo = deptStaff._id
        }
      }

      // Set SLA deadline
      const slaHours = category.slaHours
      reportData.slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)

      // Make one report past SLA
      if (i === 5) {
        reportData.slaDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000)
        reportData.isEscalated = true
        reportData.escalatedAt = new Date(Date.now() - 12 * 60 * 60 * 1000)
      }

      await Report.create(reportData)
      console.log(`  Created report: ${ticketId} (${status})`)
      reportCount++
    }

    // Add two duplicate reports ~40m apart
    const dupCategory = allCategories.find(c => c.name === 'Pothole')
    if (dupCategory) {
      const dupCitizen = citizens[0]
      const baseLat = centerLat + 0.0005
      const baseLng = centerLng + 0.0005
      
      for (let j = 0; j < 2; j++) {
        const ticketId = `TICKET-DUP-${j + 1}`
        const existing = await Report.findOne({ ticketId })
        if (existing) {
          console.log(`  Duplicate report already exists: ${ticketId}`)
          continue
        }

        await Report.create({
          ticketId,
          citizen: dupCitizen._id,
          category: dupCategory._id,
          department: dupCategory.department._id,
          description: `Duplicate pothole report ${j + 1}`,
          photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/dup.jpg',
          location: {
            lat: baseLat + (j * 0.00036), // ~40m apart
            lng: baseLng,
          },
          status: 'reported',
          isAnonymous: false,
          reportCount: 1,
          reportedBy: [dupCitizen._id],
          priorityScore: 0,
          slaDeadline: new Date(Date.now() + dupCategory.slaHours * 60 * 60 * 1000),
        })
        console.log(`  Created duplicate report: ${ticketId}`)
        reportCount++
      }
    }

    console.log(`Reports: ${reportCount} created`)

    console.log('\n=== Database Seeding Complete ===')
    console.log(`\nDocument Counts:`)
    console.log(`  Departments: ${await Department.countDocuments()}`)
    console.log(`  Categories: ${await Category.countDocuments()}`)
    console.log(`  Users: ${await User.countDocuments()}`)
    console.log(`  Reports: ${await Report.countDocuments()}`)

    console.log(`\n=== Demo Credentials ===`)
    console.log(`Admin: ${adminEmail} / ${adminPassword}`)
    console.log(`Staff/Citizens: / ${demoPassword}`)
    console.log(`Staff emails: roads@nivaran.gov, watersupply@nivaran.gov, sanitation@nivaran.gov`)
    console.log(`Citizen emails: citizen1@example.com, citizen2@example.com`)

    process.exit(0)
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()
