import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 读取 dsh profile 的 package.json,返回 bundles + dependencies。
 * profile 路径: ~/.dsh/profiles/<name>/package.json
 */
export function loadProfile(profileName = 'web') {
  const dir = path.join(os.homedir(), '.dsh', 'profiles', profileName)
  const file = path.join(dir, 'package.json')
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const pkg = JSON.parse(raw)
    return {
      name: pkg.name ?? 'dsh-profile',
      bundles: pkg?.dsh?.profile?.bundles ?? [],
      dependencies: pkg?.dependencies ?? {},
    }
  } catch {
    return { name: profileName, bundles: [], dependencies: {} }
  }
}

export default loadProfile