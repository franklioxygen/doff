import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const rootDir = process.cwd()

const files = {
  packageJson: path.resolve(rootDir, 'package.json'),
  cargoToml: path.resolve(rootDir, 'src-tauri/Cargo.toml'),
  cargoLock: path.resolve(rootDir, 'src-tauri/Cargo.lock'),
  tauriConfig: path.resolve(rootDir, 'src-tauri/tauri.conf.json'),
}

const cliVersion = getCliVersion(process.argv.slice(2))
const packageJson = JSON.parse(await readFile(files.packageJson, 'utf8'))
const version = cliVersion ?? packageJson.version

if (!version) {
  console.error('Unable to determine a version to sync.')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${version}`)
  process.exit(1)
}

const updatedPackageJson = await syncPackageJson(version)
const updatedCargoToml = await syncCargoToml(version)
const updatedCargoLock = await syncCargoLock(version)
const updatedTauriConfig = await syncTauriConfig(version)

const changedFiles = [
  updatedPackageJson && 'package.json',
  updatedCargoToml && 'src-tauri/Cargo.toml',
  updatedCargoLock && 'src-tauri/Cargo.lock',
  updatedTauriConfig && 'src-tauri/tauri.conf.json',
].filter(Boolean)

if (changedFiles.length === 0) {
  console.log(`All versioned files already match ${version}.`)
} else {
  console.log(`Synced ${version} in: ${changedFiles.join(', ')}`)
}

function getCliVersion(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--version') {
      return argv[index + 1]
    }

    if (arg.startsWith('--version=')) {
      return arg.slice('--version='.length)
    }
  }

  return null
}

async function syncPackageJson(version) {
  const currentText = await readFile(files.packageJson, 'utf8')
  const currentJson = JSON.parse(currentText)

  if (currentJson.version === version) {
    return false
  }

  currentJson.version = version
  await writeFile(files.packageJson, `${JSON.stringify(currentJson, null, 2)}\n`, 'utf8')
  return true
}

async function syncCargoToml(version) {
  const currentText = await readFile(files.cargoToml, 'utf8')
  const nextText = replaceOrThrow(
    currentText,
    /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
    version,
    'src-tauri/Cargo.toml package version',
  )

  if (nextText === currentText) {
    return false
  }

  await writeFile(files.cargoToml, nextText, 'utf8')
  return true
}

async function syncCargoLock(version) {
  const currentText = await readFile(files.cargoLock, 'utf8')
  const nextText = replaceOrThrow(
    currentText,
    /(\[\[package\]\]\r?\nname = "doff"\r?\nversion = ")[^"]+(")/,
    version,
    'src-tauri/Cargo.lock root package version',
  )

  if (nextText === currentText) {
    return false
  }

  await writeFile(files.cargoLock, nextText, 'utf8')
  return true
}

async function syncTauriConfig(version) {
  const currentText = await readFile(files.tauriConfig, 'utf8')
  const currentJson = JSON.parse(currentText)

  if (currentJson.version === version) {
    return false
  }

  currentJson.version = version
  await writeFile(files.tauriConfig, `${JSON.stringify(currentJson, null, 2)}\n`, 'utf8')
  return true
}

function replaceOrThrow(text, pattern, version, label) {
  if (!pattern.test(text)) {
    console.error(`Unable to find ${label}.`)
    process.exit(1)
  }

  return text.replace(pattern, `$1${version}$2`)
}
