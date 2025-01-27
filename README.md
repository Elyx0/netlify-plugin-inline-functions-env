# netlify-plugin-inline-functions-env-typescript

[![npm version](https://badge.fury.io/js/netlify-plugin-inline-functions-env-typescript.svg)](https://badge.fury.io/js/netlify-plugin-inline-functions-env-typescript)

[![test status](https://github.com/bencao/netlify-plugin-inline-functions-env-typescript/workflows/UnitTest/badge.svg)](https://github.com/bencao/netlify-plugin-inline-functions-env-typescript/actions)

Inline build time environment variable values into netlify function code so that it becomes available at runtime.

## Why

When we talk about environment variable values for a netlify function, it is important to understand that there're two possible contexts.

**Build time**

This is when netlify builds your site. The following environment variables would be available at build time:

- Environment Variables you set at Netlify UI
- [Readonly Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables) set by Netlify including build/git metadata
- [Deploy Context Environment Variables](https://docs.netlify.com/configure-builds/file-based-configuration/#deploy-contexts) you set in `netlify.toml` within `[context.xxx.environment]` section
- Environment Variables set by other Netlify build plugins such as [contextual env plugin](https://github.com/cball/netlify-plugin-contextual-env#readme)

**Runtime**

This is when your function code is evaluated when a request was received. The following environment variables would be available at runtime:

- Environment Variables you set at Netlify UI

**The Problem**

You may have noticed that the available environment variables at Runtime is only a subset of that in build time.

That is a common source of confusion for many people, see those discussions over [here](https://community.netlify.com/t/support-guide-using-environment-variables-on-netlify-correctly/267).

This plugin was built to mitigate this issue by inlining the build time environment variable values as part of your code, so that you can consider build time environment variables magically become available for runtime!

With the original function source file

```
function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      CONTEXT: process.env.CONTEXT
    })
  };
};

module.exports = { handler };
```

The plugin will produce the inlined function source file

```
function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({
      CONTEXT: "deploy-preview"    <---------- replaced with build time only env var values
    })
  };
};

module.exports = { handler };
```

**Caveats**

The plugin wouldn't replace more dynamic code like the following ones

```
console.log(process.env);          <-------- no concrete values, won't be replaced with an object


const { CONTEXT } = process.env;   <-------- destructuring won't work! Please use process.env.CONTEXT instead (this also makes it more explicit and easier to search globally for process.env dependencies)


function getKey(key) {
  return process.env[key];         <-------- rely on runtime value so won't be replaced
}
```

So you may have to intentionlly convert the above code into something like `process.env.X` so it will be inlined.

## Install

add the following lines to your `netlify.toml` file:

```toml
[[plugins]]
package = "netlify-plugin-inline-functions-env-typescript"
```

To complete file-based installation, from your project's base directory, use npm, yarn, or any other Node.js package manager to add the plugin to `devDependencies` in `package.json`.

```bash
npm install -D netlify-plugin-inline-functions-env-typescript
```

## More Options

### Debugging

You can turn on verbose for debugging purpose by providing plugin inputs.

```toml
[[plugins]]
package = "netlify-plugin-inline-functions-env-typescript"
  [plugins.inputs]
  verbose = "true"
  inlineAll = "true"
```

> `inlineAll` will try to find all the `.ts` or `.js` files in your FUNCTIONS_SRC directory

It might be recommended in the case your entry function imports other files that
use `process.env` in them. As it seems the original plugin did not replace alongside the dependency tree.

> Be careful with verbose mode, as it will print the files with the replaced env variables

### Conditional Transformation

If you are using libraries such as [dotenv-defaults](https://github.com/mrsteele/dotenv-defaults), you may want to limit or skip the transformation for certain environment variables.

```toml
[[plugins]]
package = "netlify-plugin-inline-functions-env-typescript"
  [plugins.inputs]
  exclude = ["DO_NOT_TRANSFORM_ME", "DO_NOT_TRANSFORM_ME_2"]
```

```toml
[[plugins]]
package = "netlify-plugin-inline-functions-env-typescript"
  [plugins.inputs]
  include = ["ONLY_TRANSFORM_ME", "ONLY_TRANSFORM_ME_2"]
```

## Gotchas

1. The `[[plugins]]` line is required for each plugin, even if you have other plugins in your `netlify.toml` file already.

2. This plugin only replaces variables in the functions directory. Files outside the directory won't be modified.

3. If you want to lock to a specific version(or a version that hasn't been accepted by netlify build system yet), please add `netlify-plugin-inline-functions-env-typescript` to your dev dependencies by `yarn install --dev netlify-plugin-inline-functions-env-typescript` or `npm install --save-dev netlify-plugin-inline-functions-env-typescript`.
4. THE PLUGIN CANNOT REPLACE process.env imported from OUTSIDE of the /functions/ repository. So I recommend putting SHARED_GLOBALS, in a `functions/shared_global.ts` and also create a `functions/backend_globals.ts` so then your frontend should be able to `import` the shared_globals while in `src/` from `../functions/shared_globals` (at least that's how I did for Gatsby + Netlify + Typescript) Good luck, hit me up if problems.
