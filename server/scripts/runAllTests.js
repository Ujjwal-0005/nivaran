/**
 * server/scripts/runAllTests.js
 *
 * Runs db:fresh:test once, then executes the test suites sequentially:
 *   1. test:isolation
 *   2. test:superadmin
 *   3. test:staff
 *   4. test:sectors
 *   5. test:routing
 *
 * Stops immediately on the first failure.
 * Prints a final summary of all passed suites.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(__dirname, '..')

const suites = [
  { name: 'db:fresh:test', file: 'scripts/freshTestDb.js' },
  { name: 'test:isolation', file: 'tests/tenantIsolation.test.js' },
  { name: 'test:superadmin', file: 'tests/superadmin.test.js' },
  { name: 'test:staff', file: 'tests/staffApproval.test.js' },
  { name: 'test:sectors', file: 'tests/sectors.test.js' },
  { name: 'test:routing', file: 'tests/routing.test.js' },
  { name: 'test:deptadmin', file: 'tests/deptadmin.test.js' },
  { name: 'test:cities', file: 'tests/cities.test.js' },
  { name: 'test:crosscity', file: 'tests/crossCityReport.test.js' },
  { name: 'test:scale', file: 'tests/scale.test.js' },
]

function runStep(suite) {
  return new Promise((resolve, reject) => {
    const fullPath = path.resolve(serverDir, suite.file)
    console.log(`\n==================================================`)
    console.log(`🚀 Running ${suite.name} (${suite.file})`)
    console.log(`==================================================\n`)

    const child = spawn(process.execPath, [fullPath], {
      cwd: serverDir,
      stdio: 'inherit',
      env: process.env,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${suite.name} exited with non-zero exit code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

async function main() {
  const startTime = Date.now()
  const passedSuites = []

  for (const suite of suites) {
    try {
      await runStep(suite)
      passedSuites.push(suite.name)
    } catch (err) {
      console.error(`\n❌ Execution halted: ${err.message}`)
      console.error(`Suites passed prior to failure: ${passedSuites.join(', ') || 'None'}`)
      process.exit(1)
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n==================================================`)
  console.log(`🎉 ALL TESTS PASSED (${durationSec}s)`)
  console.log(`==================================================`)
  passedSuites.forEach((s) => console.log(`  ✅ ${s}`))
  console.log(`==================================================\n`)
  process.exit(0)
}

main()
