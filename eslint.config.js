import { createRequire } from 'module'
import { FlatCompat } from '@eslint/eslintrc'
const require = createRequire(import.meta.url)
const eslintrc = require('./.eslintrc.json')
const compat = new FlatCompat({ recommendedConfig: {}, allConfig: {} })
export default compat.config(eslintrc)
