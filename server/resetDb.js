import dotenv from 'dotenv'
import mongoose from 'mongoose'
import connectDB from './config/db.js'

dotenv.config()

const resetDatabase = async () => {
  try {
    // Check for --confirm flag
    const confirmFlag = process.argv.includes('--confirm')
    if (!confirmFlag) {
      console.error('ERROR: This command will drop all collections in the database.')
      console.error('To proceed, use: node resetDb.js --confirm')
      process.exit(1)
    }

    await connectDB()

    const dbName = mongoose.connection.name
    const dbHost = mongoose.connection.host

    console.log(`\n=== WARNING ===`)
    console.log(`Database: ${dbName}`)
    console.log(`Host: ${dbHost}`)
    console.log(`\nThis will DELETE ALL DATA in the database.`)
    console.log(`Press Ctrl+C to cancel, or wait 3 seconds to proceed...`)

    // 3 second delay for safety
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log(`\nDropping all collections...`)

    const collections = await mongoose.connection.db.collections()
    
    for (const collection of collections) {
      await collection.deleteMany({})
      console.log(`  Dropped: ${collection.collectionName}`)
    }

    console.log(`\n=== Database Reset Complete ===`)
    console.log(`All collections in "${dbName}" have been cleared.`)
    console.log(`Run "npm run seed" to populate the database.`)

    process.exit(0)
  } catch (error) {
    console.error('Error resetting database:', error)
    process.exit(1)
  }
}

resetDatabase()
