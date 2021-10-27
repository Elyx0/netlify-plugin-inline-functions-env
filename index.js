const fs = require('fs');
const util = require('util');
const babel = require('@babel/core');
const inlinePlugin = require('babel-plugin-transform-inline-environment-variables');
const tsPlugin = require('@babel/plugin-transform-typescript');
const { normalizeInputValue, isJsFunction, getSrcFile, uniq } = require('./lib');
const writeFile = util.promisify(fs.writeFile);

const path = require('path');

const readDirRecursive = async (filePath) => {
    const dir = await fs.promises.readdir(filePath);
    const files = await Promise.all(dir.map(async realtivePath => {
        const absolutePath = path.join(filePath, realtivePath);
        const stat = await fs.promises.lstat(absolutePath);

        return stat.isDirectory() ? readDirRecursive(absolutePath) : absolutePath;
    }));

    return files.flat();
}

async function inlineEnv(path, options = {}, verbose = false) {
  console.log('inlining', path);

  const transformed = await babel.transformFileAsync(path, {
    configFile: false,
    plugins: [babel.createConfigItem([tsPlugin, options]),babel.createConfigItem([inlinePlugin, options])],
    retainLines: true,
  });

  if (verbose) {
    console.log('transformed code', transformed.code)
  }

  await writeFile(path, transformed.code, 'utf8')
}

async function processFiles({ inputs, constants, utils }) {
  const verbose = !!inputs.verbose

  if (verbose) {
    console.log(
      'build env contains the following environment variables',
      Object.keys(process.env)
    )
  }

  let netlifyFunctions = []

  try {
    netlifyFunctions = await utils.functions.listAll();

    if (inputs.inlineAll) {
      const additionalFiles = await readDirRecursive(constants.FUNCTIONS_SRC);
    
      if (verbose) {
        console.log('Constants:',constants);
        console.log('Loading from',constants.FUNCTIONS_SRC)
        console.log('Found',additionalFiles)
  
      }
      netlifyFunctions.push(...additionalFiles.map(file => {
        const { ext } = path.parse(file);
        const absolutePath = path.resolve(file); //path.resolve( constants.FUNCTIONS_SRC, file );
        return {
        runtime: ext.slice(1),
        extension: ext,
        srcFile: absolutePath,
        }
      }));
    }

    
  } catch (functionMissingErr) {
    console.log(functionMissingErr) // functions can be there but there is an error when executing
    return utils.build.failBuild(
      'Failed to inline function files because netlify function folder was not configured or pointed to a wrong folder, please check your configuration'
    )
  }

  const files = uniq(netlifyFunctions.filter(isJsFunction).map(getSrcFile))

  if (files.length !== 0) {
    try {
      if (verbose) {
        console.log('found function files', files)
      }

      const include = normalizeInputValue(inputs.include)
      const exclude = normalizeInputValue(inputs.exclude)

      if (verbose) {
        console.log('flags.include=', include)
        console.log('flags.exclude=', exclude)
      }

      await Promise.all(
        files.map((f) => inlineEnv(f, { include, exclude }, verbose))
      )

      utils.status.show({
        summary: `Processed ${files.length} function file(s).`,
      })
    } catch (err) {
      return utils.build.failBuild(
        `Failed to inline function files due to the following error:\n${err.message}`,
        { error: err }
      )
    }
  } else {
    utils.status.show({
      summary: 'Skipped processing because the project had no functions.',
    })
  }
}

const handler = (inputs) => {
  // Use user configured buildEvent
  const buildEvent = inputs.buildEvent || 'onPreBuild'

  return {
    [buildEvent]: processFiles,
  }
}

// expose for testing
handler.processFiles = processFiles

module.exports = handler
