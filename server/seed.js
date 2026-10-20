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
import { DEPARTMENT_TEMPLATES, seedAgenciesForCity } from './utils/departments.js'
import { calculatePriorityScore, calculateDaysOpen } from './algorithms/priorityScoring.js'
import { resolveDepartment } from './services/resolveDepartment.js'

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

// 19 national shared complaint categories
const categoriesData = [
  { name: 'Pothole', departmentKey: 'roads', sector: 'ROADS', severityWeight: 7, slaHours: 48 },
  { name: 'Damaged footpath', departmentKey: 'roads', sector: 'ROADS', severityWeight: 4, slaHours: 72 },
  { name: 'Broken traffic signal', departmentKey: 'traffic_police', sector: 'TRAFFIC_ENFORCEMENT', severityWeight: 9, slaHours: 12 },
  { name: 'Missing road signage', departmentKey: 'roads', sector: 'ROADS', severityWeight: 5, slaHours: 72 },
  { name: 'Streetlight not working', departmentKey: 'electrical', sector: 'STREET_LIGHTING', severityWeight: 6, slaHours: 24 },
  { name: 'Exposed electrical wires', departmentKey: 'electrical', sector: 'ELECTRICITY', severityWeight: 10, slaHours: 6 },
  { name: 'Water pipeline leak', departmentKey: 'water_supply', sector: 'WATER', severityWeight: 8, slaHours: 24 },
  { name: 'Low water pressure', departmentKey: 'water_supply', sector: 'WATER', severityWeight: 5, slaHours: 48 },
  { name: 'Open manhole', departmentKey: 'sewerage', sector: 'SEWERAGE', severityWeight: 10, slaHours: 6 },
  { name: 'Blocked drain', departmentKey: 'sewerage', sector: 'SEWERAGE', severityWeight: 6, slaHours: 24 },
  { name: 'Stagnant water', departmentKey: 'sewerage', sector: 'SEWERAGE', severityWeight: 7, slaHours: 48 },
  { name: 'Garbage overflow', departmentKey: 'sanitation', sector: 'SOLID_WASTE', severityWeight: 6, slaHours: 24 },
  { name: 'Illegal dumping', departmentKey: 'sanitation', sector: 'SOLID_WASTE', severityWeight: 5, slaHours: 48 },
  { name: 'Public toilet issue', departmentKey: 'sanitation', sector: 'SOLID_WASTE', severityWeight: 5, slaHours: 24 },
  { name: 'Fallen tree/branch', departmentKey: 'parks', sector: 'PARKS', severityWeight: 7, slaHours: 12 },
  { name: 'Damaged park equipment', departmentKey: 'parks', sector: 'PARKS', severityWeight: 3, slaHours: 96 },
  { name: 'Encroachment', departmentKey: 'municipal_enforcement', sector: 'ENFORCEMENT', severityWeight: 4, slaHours: 120 },
  { name: 'Stray animal issue', departmentKey: 'animal_husbandry', sector: 'ANIMAL', severityWeight: 6, slaHours: 48 },
  { name: 'Noise pollution', departmentKey: 'municipal_enforcement', sector: 'ENFORCEMENT', severityWeight: 3, slaHours: 24 },
]

// The 3 demo cities
const DEMO_CITIES = ['Jalandhar', 'Phagwara', 'Ludhiana']

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
        if (muniData.lgdCode === null || muniData.lgdCode === undefined) {
          delete muniData.lgdCode
        }

        const isDemoCity = DEMO_CITIES.includes(muniData.name)
        const initialIsActive = isDemoCity

        // Strip isActive from $set so a re-run never overwrites an admin-deactivated city.
        // $setOnInsert only runs on first insert, correctly initialising the flag.
        const { isActive: _ia, ...muniDataWithoutActive } = muniData

        const doc = await Municipality.findOneAndUpdate(
          { state: muniData.state, name: muniData.name },
          {
            $set: muniDataWithoutActive,
            $setOnInsert: { isActive: initialIsActive },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        loadedMunicipalities.push(doc)
        console.log(`  Upserted municipality: ${doc.name}, ${doc.state} (Type: ${doc.type}, Active: ${doc.isActive})`)
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
    const allCategories = await Category.find().lean()
    console.log(`Categories: ${allCategories.length} active`)

    console.log('\n=== Part 3: Seeding Per-Municipality Departments & Agencies ===')
    const muniDeptMap = new Map() // key: muniId_deptKey -> deptDoc
    for (const muni of loadedMunicipalities) {
      for (const tpl of DEPARTMENT_TEMPLATES) {
        const deptDoc = await Department.findOneAndUpdate(
          { municipality: muni._id, key: tpl.key },
          {
            $set: {
              name: tpl.name,
              key: tpl.key,
              municipality: muni._id,
              description: tpl.description,
              sector: tpl.sector,
              agencyType: tpl.agencyType || 'municipal',
              isPrimary: Boolean(tpl.isPrimary),
              isExternal: false,
              verified: false,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        muniDeptMap.set(`${muni._id.toString()}_${tpl.key}`, deptDoc)
      }
      console.log(`  Seeded 10 departments for ${muni.name}`)

      // Seed state agencies for the municipality
      const stateKey = muni.state ? muni.state.toLowerCase() : 'punjab'
      const agencies = await seedAgenciesForCity(muni._id, stateKey)
      console.log(`  Seeded ${agencies.length} state agencies for ${muni.name}`)
    }

    console.log('\n=== Part 6: Seeding Rich Demo Data for Jalandhar, Phagwara, Ludhiana ===')
    const demoPassword = process.env.DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD || 'Demo@123'
    const passwordHash = await bcrypt.hash(demoPassword, 10)

    const targetMunis = loadedMunicipalities.filter((m) => DEMO_CITIES.includes(m.name))
    let totalDemoReports = 0

    // To ensure all 19 categories are represented across the 3 cities, we will track category assignments
    // 19 categories across 3 cities: each city will get 20 reports
    const demoCityLogins = []

    for (let cIdx = 0; cIdx < targetMunis.length; cIdx++) {
      const muni = targetMunis[cIdx]
      const muniSlug = muni.name.toLowerCase().replace(/[^a-z0-9]/g, '')

      // 1 Admin per demo city
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
            isActive: true,
            isPrimaryAdmin: true,
            isDemo: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // 3 Staff across different departments (Roads, Water, Sanitation)
      const roadsDept = muniDeptMap.get(`${muni._id.toString()}_roads`)
      const waterDept = muniDeptMap.get(`${muni._id.toString()}_water_supply`)
      const sanitationDept = muniDeptMap.get(`${muni._id.toString()}_sanitation`)

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
            isActive: true,
            isDemo: true,
            tokenVersion: 0,
            applicationStatus: 'approved',
            employeeId: `EMP-${muniSlug.substring(0, 3).toUpperCase()}-R001`,
            designation: 'Road Maintenance Officer',
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
            isActive: true,
            isDemo: true,
            tokenVersion: 0,
            applicationStatus: 'approved',
            employeeId: `EMP-${muniSlug.substring(0, 3).toUpperCase()}-W001`,
            designation: 'Water Operations Supervisor',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      const staff3Email = `staff.sanitation.${muniSlug}@nivaran.gov`
      const staff3 = await User.findOneAndUpdate(
        { email: staff3Email },
        {
          $set: {
            name: `${muni.name} Sanitation Staff`,
            email: staff3Email,
            passwordHash,
            role: 'staff',
            municipality: muni._id,
            department: sanitationDept?._id,
            city: muni.name,
            state: muni.state,
            isVerified: true,
            isActive: true,
            isDemo: true,
            tokenVersion: 0,
            applicationStatus: 'approved',
            employeeId: `EMP-${muniSlug.substring(0, 3).toUpperCase()}-S001`,
            designation: 'Sanitation Inspector',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // 3 Citizens per demo city
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
            isActive: true,
            isDemo: true,
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
            isActive: true,
            isDemo: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      const citizen3Email = `citizen3.${muniSlug}@example.com`
      const citizen3 = await User.findOneAndUpdate(
        { email: citizen3Email },
        {
          $set: {
            name: `${muni.name} Citizen 3`,
            email: citizen3Email,
            passwordHash,
            role: 'citizen',
            municipality: muni._id,
            city: muni.name,
            state: muni.state,
            homeAddress: {
              text: `Civil Lines, ${muni.name}`,
              lat: muni.centroid.lat - 0.004,
              lng: muni.centroid.lng + 0.003,
            },
            isVerified: true,
            isActive: true,
            isDemo: true,
            tokenVersion: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      demoCityLogins.push({
        city: muni.name,
        admin: adminEmail,
        staff: [staff1Email, staff2Email, staff3Email],
        citizens: [citizen1Email, citizen2Email, citizen3Email],
      })

      console.log(`  Seeded 1 admin, 3 staff, 3 citizens for ${muni.name}`)

      // Fetch external agencies for this municipality for forwarding demo
      const externalAgencies = await Department.find({
        municipality: muni._id,
        isExternal: true,
        isActive: true,
      }).lean()

      const pspclAgency = externalAgencies.find((a) => a.agencyCode === 'PSPCL') || externalAgencies[0]
      const pwdAgency = externalAgencies.find((a) => a.agencyCode === 'PUNJAB-PWD-BR') || externalAgencies[1] || externalAgencies[0]

      // 20 reports per demo city (deterministic)
      // Dates spread over the last 60 days (e.g. daysAgo = 2 + (i * 2.8))
      const rng = new SeededRandom(300 + cIdx * 100)
      const citizens = [citizen1, citizen2, citizen3]
      const staffList = [staff1, staff2, staff3]

      // Map dept to staff for assignment
      const deptStaffMap = {
        roads: staff1,
        water_supply: staff2,
        sanitation: staff3,
      }

      // 20 reports per city
      for (let i = 1; i <= 20; i++) {
        const ticketId = `CIV-${muniSlug.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`

        // Deterministic category indexing to ensure all 19 categories appear across demo cities
        // With 19 categories and 3 cities (60 reports total): category index = (cIdx * 7 + i - 1) % 19
        const catIndex = (cIdx * 7 + i - 1) % allCategories.length
        const cat = allCategories[catIndex]
        const citizen = citizens[(i - 1) % citizens.length]

        // Status spread: reported, acknowledged, in_progress, resolved, disputed
        const allStatuses = ['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed']
        let status = allStatuses[(i - 1) % allStatuses.length]

        // Days ago spread from 1 to 58 days
        const daysAgo = Math.floor(1 + ((i - 1) / 19) * 56)
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

        // Lat/lng offset within ~2km of centroid
        const latOffset = (rng.next() - 0.5) * 0.02
        const lngOffset = (rng.next() - 0.5) * 0.02

        // Resolve department with existing resolveDepartment service
        const resolution = await resolveDepartment({
          municipalityId: muni._id,
          categoryId: cat._id,
        })

        let resolvedDept = resolution.department
        let isUnresolved = Boolean(resolution.unresolved)
        let routedBy = resolution.routedBy || 'sector_primary'

        // Requirement: At least one ticket per demo city with no matching department (unresolved)
        // Let report #19 be explicitly unresolved
        if (i === 19) {
          resolvedDept = null
          isUnresolved = true
          routedBy = 'none'
          status = 'reported'
        }

        // Upvotes and joined duplicates on some tickets
        const upvoteUsers = i % 4 === 0
          ? [citizens[0]._id, citizens[1]._id]
          : (i % 2 === 0 ? [citizens[0]._id] : [])
        const upvoteCount = upvoteUsers.length
        const reportCount = i % 5 === 0 ? 2 : 1
        const reportedBy = reportCount > 1 ? [citizen._id, citizens[(i) % citizens.length]._id] : [citizen._id]

        // SLA deadline calculation
        const slaDeadline = new Date(createdAt.getTime() + (cat.slaHours || 48) * 60 * 60 * 1000)
        const daysOpen = calculateDaysOpen(createdAt)
        const priorityScore = calculatePriorityScore({
          reportCount,
          severityWeight: cat.severityWeight || 5,
          daysOpen,
          upvotes: upvoteCount,
        })

        const isSlaBreached = Date.now() > slaDeadline.getTime() && !['resolved'].includes(status)

        const reportData = {
          ticketId,
          municipality: muni._id,
          citizen: citizen._id,
          category: cat._id,
          department: resolvedDept ? resolvedDept._id : null,
          departmentUnresolved: isUnresolved,
          routedBy,
          description: `${cat.name} issue observed near landmark #${i} in ${muni.name}`,
          photoUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
          location: {
            lat: Number((muni.centroid.lat + latOffset).toFixed(6)),
            lng: Number((muni.centroid.lng + lngOffset).toFixed(6)),
          },
          status,
          isAnonymous: i % 4 === 0,
          reportCount,
          reportedBy,
          upvotes: upvoteUsers,
          priorityScore,
          slaDeadline,
          isSlaBreached,
          createdAt,
          updatedAt: createdAt,
          routingHistory: [
            {
              at: createdAt,
              action: 'auto',
              toDepartment: resolvedDept ? resolvedDept._id : null,
              reason: `Initial automated routing via ${routedBy}`,
            },
          ],
        }

        // Requirement: At least two tickets forwarded to an external agency (with an agency reference)
        // Tickets #7 and #14
        if (i === 7 && pspclAgency) {
          reportData.department = pspclAgency._id
          reportData.status = 'acknowledged'
          reportData.assignedTo = null
          reportData.forwarding = {
            forwardedAt: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000),
            forwardedBy: adminUser._id,
            agencyReference: `PSPCL-${muniSlug.toUpperCase()}-REF-00${i}`,
            note: 'Forwarded to Punjab State Power Corporation for high-voltage grid repair.',
          }
          reportData.routingHistory.push({
            at: new Date(createdAt.getTime() + 4 * 60 * 60 * 1000),
            action: 'forward',
            toDepartment: pspclAgency._id,
            byUser: adminUser._id,
            reason: 'Forwarded to external utility authority',
          })
        } else if (i === 14 && pwdAgency) {
          reportData.department = pwdAgency._id
          reportData.status = 'in_progress'
          reportData.assignedTo = null
          reportData.forwarding = {
            forwardedAt: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000),
            forwardedBy: adminUser._id,
            agencyReference: `PWD-${muniSlug.toUpperCase()}-B-R-${i}`,
            note: 'Forwarded to Punjab PWD B&R division as arterial highway is outside MC jurisdiction.',
          }
          reportData.routingHistory.push({
            at: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000),
            action: 'forward',
            toDepartment: pwdAgency._id,
            byUser: adminUser._id,
            reason: 'State highway jurisdiction',
          })
        } else {
          // Normal municipal ticket assignment and resolution notes
          const assignedStaff = resolvedDept?.isExternal
            ? null
            : (deptStaffMap[cat.departmentKey] || staff1)

          if (status === 'resolved') {
            reportData.assignedTo = assignedStaff?._id || null
            reportData.resolutionPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/resolved.jpg'
            reportData.resolutionNote = `Fixed by ${muni.name} civic department inspection team.`
            reportData.resolvedAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
          } else if (status === 'disputed') {
            reportData.assignedTo = assignedStaff?._id || null
            reportData.isDisputed = true
            reportData.disputeReason = 'Repair work was substandard and issue recurred.'
          } else if (['acknowledged', 'in_progress'].includes(status)) {
            reportData.assignedTo = assignedStaff?._id || null
          }
        }

        await Report.findOneAndUpdate(
          { ticketId },
          { $set: reportData },
          { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: false }
        )
        totalDemoReports++
      }

      // Add 2 duplicate test reports ~40m apart
      const dupCategory = allCategories.find((c) => c.name === 'Pothole') || allCategories[0]
      const dupDept = muniDeptMap.get(`${muni._id.toString()}_${dupCategory.departmentKey}`)
      const baseLat = muni.centroid.lat + 0.001
      const baseLng = muni.centroid.lng + 0.001

      for (let j = 1; j <= 2; j++) {
        const dupTicketId = `CIV-${muniSlug.substring(0, 3).toUpperCase()}-DUP-${j}`
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
              slaDeadline: new Date(Date.now() + (dupCategory.slaHours || 48) * 60 * 60 * 1000),
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
    for (const d of demoCityLogins) {
      console.log(`\nCity: ${d.city}`)
      console.log(`  Admin:    ${d.admin}`)
      console.log(`  Staff:    ${d.staff.join(', ')}`)
      console.log(`  Citizens: ${d.citizens.join(', ')}`)
    }
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
