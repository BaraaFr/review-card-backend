const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { transformSync } = require('esbuild');

// Load each subject in isolation, replacing only its external boundaries.
// Production modules keep their normal imports and do not open real services.
function loadModule(filename, mocks = {}, cache = new Map()) {
  const resolved = path.resolve(filename);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const subject = new Module(resolved, module);
  subject.filename = resolved;
  subject.paths = Module._nodeModulePaths(path.dirname(resolved));
  cache.set(resolved, subject);
  const originalRequire = subject.require.bind(subject);
  subject.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const source = path.resolve(path.dirname(resolved), name.replace(/\.js$/, '.ts'));
      if (fs.existsSync(source)) return loadModule(source, mocks, cache);
    }
    return originalRequire(name);
  };
  const code = transformSync(fs.readFileSync(resolved, 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'node22',
  }).code;
  subject._compile(code, resolved);
  return subject.exports;
}

function response() {
  return {
    statusCode: 200, headers: {},
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

module.exports = { loadModule, response };
