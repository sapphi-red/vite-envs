import { convertToVitestEnvironment } from '@vite-env/core/compat'
import { vercelEdgeEnv } from './index.js'

export default convertToVitestEnvironment('edge-light', vercelEdgeEnv)
