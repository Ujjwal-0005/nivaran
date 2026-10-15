import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Municipality from './models/Municipality.js'
import Department from './models/Department.js'
import Category from './models/Category.js'
import User from './models/User.js'
import Report from './models/Report.js'
import connectDB from './config/db.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Seeded random generator for reproducible demo reports
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

// 10 base departments
const departmentTemplates = [
  { name: 'Roads', key: 'roads', description: 'Road maintenance and infrastructure' },
  { name: 'Electrical', key: 'electrical', description: 'Electrical infrastructure and streetlights' },
  { name: 'Water Supply', key: 'water_supply', description: 'Water supply and pipeline maintenance' },
  { name: 'Sewerage', key: 'sewerage', description: 'Sewerage and drainage systems' },
  { name: 'Sanitation', key: 'sanitation', description: 'Waste management and sanitation' },
  { name: 'Parks', key: 'parks', description: 'Public parks and green spaces' },
  { name: 'Traffic Police', key: 'traffic_police', description: 'Traffic management and signals' },
  { name: 'Municipal Enforcement', key: 'municipal_enforcement', description: 'Municipal regulations enforcement' },
  { name: 'Health', key: 'health', description: 'Public health services' },
  { name: 'Animal Husbandry', key: 'animal_husbandry', description: 'Animal control and welfare' },
]

// 19 national shared complaint categories
const categoriesData = [
  { name: 'Pothole', departmentKey: 'roads', severityWeight: 7, slaHours: 48 },
  { name: 'Damaged footpath', departmentKey: 'roads', severityWeight: 4, slaHours: 72 },
  { name: 'Broken traffic signal', departmentKey: 'traffic_police', severityWeight: 9, slaHours: 12 },
  { name: 'Missing road signage', departmentKey: 'roads', severityWeight: 5, slaHours: 72 },
  { name: 'Streetlight not working', departmentKey: 'electrical', severityWeight: 6, slaHours: 24 },
  { name: 'Exposed electrical wires', departmentKey: 'electrical', severityWeight: 10, slaHours: 6 },
  { name: 'Water pipeline leak', departmentKey: 'water_supply', severityWeight: 8, slaHours: 24 },
  { name: 'Low water pressure', departmentKey: 'water_supply', severityWeight: 5, slaHours: 48 },
  { name: 'Open manhole', departmentKey: 'sewerage', severityWeight: 10, slaHours: 6 },
  { name: 'Blocked drain', departmentKey: 'sewerage', severityWeight: 6, slaHours: 24 },
  { name: 'Stagnant water', departmentKey: 'sewerage', severityWeight: 7, slaHours: 48 },
  { name: 'Garbage overflow', departmentKey: 'sanitation', severityWeight: 6, slaHours: 24 },
  { name: 'Illegal dumping', departmentKey: 'sanitation', severityWeight: 5, slaHours: 48 },
  { name: 'Public toilet issue', departmentKey: 'sanitation', severityWeight: 5, slaHours: 24 },
  { name: 'Fallen tree/branch', departmentKey: 'parks', severityWeight: 7, slaHours: 12 },
  { name: 'Damaged park equipment', departmentKey: 'parks', severityWeight: 3, slaHours: 96 },
  { name: 'Encroachment', departmentKey: 'municipal_enforcement', severityWeight: 4, slaHours: 120 },
  { name: 'Stray animal issue', departmentKey: 'animal_husbandry', severityWeight: 6, slaHours: 48 },
  { name: 'Noise pollution', departmentKey: 'municipal_enforcement', severityWeight: 3, slaHours: 24 },
]

export const seedDatabase = async () => {
  try {
    await connectDB()

    console.log('=== Part 2: Loading State Seed Files Dynamically ===')
    const statesDir = path.join(__dirname, 'seed-data', 'states')
    if (!fs.existsSync(statesDir)) {
      throw new Error(`States directory not found at ${statesDir}`)
    }

    const stateFiles = fs.readdirSync(statesDir).filter((file) => file.endsWith('.json'))
    console.log(`Found ${stateFiles.length} state file(s): ${stateFiles.join(', ')}`)

    const loadedMunicipalities = []
    for (const file of stateFiles) {
      const filePath = path.join(statesDir, file)
      const rawContent = fs.readFileSync(filePath, 'utf-8')
      const municipalitiesList = JSON.parse(rawContent)

      for (const muni of municipalitiesList) {
        // Upsert by { state, name }
        const { _verify, ...muniData } = muni
        const doc = await Municipality.findOneAndUpdate(
          { state: muniData.state, name: muniData.name },
          { $set: muniData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        loadedMunicipalities.push(doc)
        console.log(`  Upserted municipality: ${doc.name}, ${doc.state} (Type: ${doc.type})`)
      }
    }
    console.log(`Total Municipalities Loaded: ${loadedMunicipalities.length}`)

    console.log('\n=== Part 3: Seeding National Categories ===')
    for (const cat of categoriesData) {
      await Category.findOneAndUpdate(
        { name: cat.name },
        { $set: cat },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    }
    const allCategories = await Category.find()
    console.log(`Categories: ${allCategories.length} active`)

    console.log('\n=== Part 3: Seeding Per-Municipality Departments ===')
    const muniDeptMap = new Map() // key: muniId_deptKey -> deptDoc
    for (const muni of loadedMunicipalities) {
      for (const tpl of departmentTemplates) {
        const deptDoc = await Department.findOneAndUpdate(
          { municipality: muni._id, key: tpl.key },
          {
            $set: {
              name: tpl.name,
              key: tpl.key,
              municipality: muni._id,
              description: tpl.description,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        muniDeptMap.set(`${muni._id.toString()}_${tpl.key}`, deptDoc)
      }
      console.log(`  Seeded 10 departments for ${muni.name}`)
    }

    console.log('\n=== Part 7: Seeding Demo Accounts & Reports for Jalandhar & Phagwara ===')
    const demoPassword = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'Demo@123'
    const passwordHash = await bcrypt.hash(demoPassword, 10)

    const targetMunis = loadedMunicipalities.filter((m) =>
      ['Jalandhar', 'Phagwara'].includes(m.name)
    )

    let totalDemoReports = 0

    for (const muni of targetMunis) {
      const muniSlug = muni.name.toLowerCase()

      // 1 Admin per municipality
      const adminEmail = `admin.${muniSlug}@nivaran.gov`
      const adminUser = await User.findOneAndUpdate(
        { email: adminEmail },
        {
          $set: {
            name: `${muni.name} Admin`,
            email: adminEmail,
            passwordHash,
            role: 'admin',
            municipality: muni._id,
            city: muni.name,
            state: muni.state,
            isVerified: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // 2 Staff in different departments (Roads and Water Supply)
      const roadsDept = muniDeptMap.get(`${muni._id.toString()}_roads`)
      const waterDept = muniDeptMap.get(`${muni._id.toString()}_water_supply`)

      const staff1Email = `staff.roads.${muniSlug}@nivaran.gov`
      const staff1 = await User.findOneAndUpdate(
        { email: staff1Email },
        {
          $set: {
            name: `${muni.name} Roads Staff`,
            email: staff1Email,
            passwordHash,
            role: 'staff',
            municipality: muni._id,
            department: roadsDept?._id,
            city: muni.name,
            state: muni.state,
            isVerified: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      const staff2Email = `staff.water.${muniSlug}@nivaran.gov`
      const staff2 = await User.findOneAndUpdate(
        { email: staff2Email },
        {
          $set: {
            name: `${muni.name} Water Staff`,
            email: staff2Email,
            passwordHash,
            role: 'staff',
            municipality: muni._id,
            department: waterDept?._id,
            city: muni.name,
            state: muni.state,
            isVerified: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // 2 Citizens
      const citizen1Email = `citizen1.${muniSlug}@example.com`
      const citizen1 = await User.findOneAndUpdate(
        { email: citizen1Email },
        {
          $set: {
            name: `${muni.name} Citizen 1`,
            email: citizen1Email,
            passwordHash,
            role: 'citizen',
            municipality: muni._id,
            city: muni.name,
            state: muni.state,
            homeAddress: {
              text: `Model Town, ${muni.name}`,
              lat: muni.centroid.lat,
              lng: muni.centroid.lng,
            },
            isVerified: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      const citizen2Email = `citizen2.${muniSlug}@example.com`
      const citizen2 = await User.findOneAndUpdate(
        { email: citizen2Email },
        {
          $set: {
            name: `${muni.name} Citizen 2`,
            email: citizen2Email,
            passwordHash,
            role: 'citizen',
            municipality: muni._id,
            city: muni.name,
            state: muni.state,
            homeAddress: {
              text: `Urban Estate, ${muni.name}`,
              lat: muni.centroid.lat + 0.005,
              lng: muni.centroid.lng + 0.005,
            },
            isVerified: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      console.log(`  Seeded 1 admin, 2 staff, 2 citizens for ${muni.name}`)

      // Seed ~8 reports per municipality at centroid + random offset within ~2km
      // Using deterministic seed per city
      const citySeed = muni.name === 'Jalandhar' ? 101 : 202
      const rng = new SeededRandom(citySeed)
      const statuses = ['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed']
      const citizens = [citizen1, citizen2]
      const staffList = [staff1, staff2]

      for (let i = 1; i <= 8; i++) {
        const ticketId = `CIV-${muni.name.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`
        const cat = rng.choice(allCategories)
        const citizen = rng.choice(citizens)
        const status = statuses[(i - 1) % statuses.length]

        // ~2km radius: 1 deg lat ~ 111 km, 2km ~ 0.018 deg
        const latOffset = (rng.next() - 0.5) * 0.018
        const lngOffset = (rng.next() - 0.5) * 0.018

        const dept = muniDeptMap.get(`${muni._id.toString()}_${cat.departmentKey}`)

        const reportData = {
          ticketId,
          municipality: muni._id,
          citizen: citizen._id,
          category: cat._id,
          department: dept ? dept._id : null,
          departmentUnresolved: !dept,
          description: `${cat.name} problem near landmark #${i} in ${muni.name}`,
          photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
          location: {
            lat: Number((muni.centroid.lat + latOffset).toFixed(6)),
            lng: Number((muni.centroid.lng + lngOffset).toFixed(6)),
          },
          status,
          isAnonymous: i % 3 === 0,
          reportCount: 1,
          reportedBy: [citizen._id],
          priorityScore: 0,
          slaDeadline: new Date(Date.now() + cat.slaHours * 60 * 60 * 1000),
        }

        if (status === 'resolved') {
          reportData.resolutionPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/resolved.jpg'
          reportData.resolutionNote = `Repaired by ${muni.name} municipal maintenance crew.`
          reportData.resolvedAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
          reportData.assignedTo = staff1._id
        } else if (status === 'disputed') {
          reportData.isDisputed = true
          reportData.disputeReason = 'Work incomplete or poor quality after fixing'
          reportData.assignedTo = staff2._id
        } else if (['acknowledged', 'in_progress'].includes(status)) {
          reportData.assignedTo = (cat.departmentKey === 'roads' ? staff1 : staff2)._id
        }

        await Report.findOneAndUpdate(
          { ticketId },
          { $set: reportData },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        totalDemoReports++
      }

      // Add two same-category reports ~40m apart for duplicate detection demo
      const dupCategory = allCategories.find((c) => c.name === 'Pothole') || allCategories[0]
      const dupDept = muniDeptMap.get(`${muni._id.toString()}_${dupCategory.departmentKey}`)
      const baseLat = muni.centroid.lat + 0.001
      const baseLng = muni.centroid.lng + 0.001

      for (let j = 1; j <= 2; j++) {
        const dupTicketId = `CIV-${muni.name.substring(0, 3).toUpperCase()}-DUP-${j}`
        await Report.findOneAndUpdate(
          { ticketId: dupTicketId },
          {
            $set: {
              ticketId: dupTicketId,
              municipality: muni._id,
              citizen: citizen1._id,
              category: dupCategory._id,
              department: dupDept ? dupDept._id : null,
              departmentUnresolved: !dupDept,
              description: `Pothole reported near main road junction ${j}`,
              photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
              location: {
                lat: Number((baseLat + (j - 1) * 0.00036).toFixed(6)), // ~40m apart
                lng: Number(baseLng.toFixed(6)),
              },
              status: 'reported',
              isAnonymous: false,
              reportCount: 1,
              reportedBy: [citizen1._id],
              priorityScore: 0,
              slaDeadline: new Date(Date.now() + dupCategory.slaHours * 60 * 60 * 1000),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        totalDemoReports++
      }
    }

    console.log(`\n=== Database Seeding Complete ===`)
    console.log(`Document Counts:`)
    console.log(`  Municipalities: ${await Municipality.countDocuments()}`)
    console.log(`  Departments: ${await Department.countDocuments()}`)
    console.log(`  Categories: ${await Category.countDocuments()}`)
    console.log(`  Users: ${await User.countDocuments()}`)
    console.log(`  Reports: ${await Report.countDocuments()}`)

    console.log(`\n=== Demo Logins (Password: ${demoPassword}) ===`)
    console.log(`Jalandhar Admin: admin.jalandhar@nivaran.gov`)
    console.log(`Phagwara Admin: admin.phagwara@nivaran.gov`)
    console.log(`Jalandhar Staff: staff.roads.jalandhar@nivaran.gov, staff.water.jalandhar@nivaran.gov`)
    console.log(`Phagwara Staff: staff.roads.phagwara@nivaran.gov, staff.water.phagwara@nivaran.gov`)
    console.log(`Jalandhar Citizens: citizen1.jalandhar@example.com, citizen2.jalandhar@example.com`)
    console.log(`Phagwara Citizens: citizen1.phagwara@example.com, citizen2.phagwara@example.com`)
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

if (process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed'))) {
  seedDatabase()
    .then(() => {
      console.log('Seeder finished successfully.')
      process.exit(0)
    })
    .catch(() => process.exit(1))
}
