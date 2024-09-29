
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const LOCK_FILE_DATA = {
  name: 'nexus',
  version: '1.0.0',
  lockfileVersion: 1,
  requires: true,
  dependencies: {},
}

const executCommand = async (command) => {
  return new Promise((resolve, reject) => {
    exec(command, function (error, stdout, stderr) { resolve(stdout) })
  })
}

const run = async () => {

  console.log('CLEARING NODE MODULES')
  await executCommand('rm -rf ./node_modules')
  console.log('CLEARING CACHE')
  await executCommand('npm cache clean --force')
  console.log('UPDATING LOCK FILE')
  await executCommand(`echo '${JSON.stringify(LOCK_FILE_DATA, null, 2)}' > ./package-lock.json`)
  console.log('INSTALLING')
  await executCommand('npm install')
  console.log('\u0007')

}

run()
