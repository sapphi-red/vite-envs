import { convertToVitestEnvironment } from '@vite-env/core/compat'
import { cloudflarePagesEnv } from './index.js'

export default convertToVitestEnvironment('workerd', cloudflarePagesEnv)
