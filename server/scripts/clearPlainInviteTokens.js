import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from '../models/User.js'

dotenv.config()

/**
 * Clear existing unhashed passwordSetTokens so that legacy plain tokens
 * cannot be misused after moving to SHA-256 token hashing.
 */
async function clearPlainTokens() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI
    if (!mongoUri) {
      throw new Error('MONGO_URI is not set in environment')
    }
    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    const result = await User.updateMany(
      { passwordSetToken: { $ne: null } },
      {
        $set: {
          passwordSetToken: null,
          passwordSetTokenExpiry: null,
        },
      }
    )

    console.log(`Cleared plain invite tokens from ${result.modifiedCount} user(s).`)
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
    process.exit(0)
  } catch (err) {
    console.error('Error clearing tokens:', err)
    process.exit(1)
  }
}

clearPlainTokens()
