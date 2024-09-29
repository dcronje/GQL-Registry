const fs = require('fs')
const path = require('path')
const { spawn, exec } = require('child_process')

const LOCK_FILE_DATA = {
  name: 'nexus',
  version: '1.0.0',
  lockfileVersion: 1,
  requires: true,
  dependencies: {},
}

const installPackages = async (type, packages) => {
  return new Promise((resolve, reject) => {
    const commands = ['install', type, ...packages]
    console.log(commands.join(' '))
    const inst = spawn('npm', commands, { stdio: 'inherit' })
    inst.on('close', function (code) {
      if (code === 8) {
        reject('ERROR')
      }
      resolve()
    })
  })
}

const executCommand = async (command) => {
  return new Promise((resolve, reject) => {
    exec(command, function (error, stdout, stderr) { resolve(stdout) })
  })
}

const run = async () => {
  const packageString = fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8')
  const packageJson = JSON.parse(packageString)

  let dependencies
  let devDependencies
  let peerDependencies

  if (packageJson.dependencies) {
    dependencies = { ...packageJson.dependencies }
    packageJson.dependencies = {}
  }
  if (packageJson.devDependencies) {
    devDependencies = { ...packageJson.devDependencies }
    packageJson.devDependencies = {}
  }
  if (packageJson.peerDependencies) {
    peerDependencies = { ...packageJson.peerDependencies }
    packageJson.peerDependencies = {}
  }

  if (peerDependencies) {
    const packages = Object.keys(peerDependencies)
    for (p = 0; p < packages.length; p++) {
      const result = await executCommand(`npm show ${packages[p]} version`)
      console.log(`Updating peer: ${packages[p]} from ${peerDependencies[packages[p]]} to ^${result.replace('\n', '')}`)
      packageJson.peerDependencies[packages[p]] = `^${result.replace('\n', '')}`
    }
  }

  // Write Package file
  fs.writeFileSync(path.resolve(__dirname, './package-lock.json'), JSON.stringify(LOCK_FILE_DATA, null, 2))
  fs.writeFileSync(path.resolve(__dirname, './package.json'), JSON.stringify(packageJson, null, 2))

  await executCommand('rm -rf ./node_modules')
  await executCommand('npm cache clean --force')
  if (dependencies) {
    const packages = Object.keys(dependencies)
    await installPackages('--save', packages)
  }
  if (devDependencies) {
    const packages = Object.keys(devDependencies)
    await installPackages('--save-dev', packages)
  }

}

run()
