import { localTestDatabaseURL } from './database'
import { syntheticEnvironment } from './environment'

const database = localTestDatabaseURL(process.env)
const env = syntheticEnvironment(process.env, database.href)
for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
Object.assign(process.env, env)
