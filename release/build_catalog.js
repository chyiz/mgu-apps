#!/usr/bin/env node
'use strict';
/**
 * Builds MGU Store release/catalog artifacts from mgu-repo.json (including nested
 * git submodules) into dist/:
 *   - <id>@<version>.tgz   (OAP package WITHOUT node_modules/oap-sdk; car links donor)
 *   - <id>.png             (<= 128 KiB Store tile icon)
 *   - mgu-store.json       (Layout 1: GitHub Releases metadata)
 *   - catalog.json         (Layout 2: Schema 2 catalog for `catalog` release or USB stick)
 *
 * Usage:
 *   node release/build_catalog.js [--out dist] [--base-url https://github.com/<owner>/<repo>/releases/download/<tag>]
 *     [--only <id[,id...]>] [--expected-version <x.y.z>] [--merge-catalog <existing-catalog.json>]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function sha256File(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fill(tpl, vars) {
    return String(tpl).replace(/\{(id|version|dir)\}/g, (_, k) => vars[k]);
}

function parseArgs(argv) {
    const opts = {
        outDir: path.join(ROOT, 'dist'),
        baseUrl: '',
        author: 'chyiz',
        only: [],
        expectedVersion: '',
        mergeCatalog: '',
    };
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--out' && argv[i + 1]) opts.outDir = path.resolve(argv[++i]);
        else if (argv[i] === '--base-url' && argv[i + 1]) opts.baseUrl = argv[++i].replace(/\/+$/, '');
        else if (argv[i] === '--author' && argv[i + 1]) opts.author = argv[++i];
        else if (argv[i] === '--only' && argv[i + 1]) {
            opts.only.push(...argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
        } else if (argv[i] === '--expected-version' && argv[i + 1]) {
            opts.expectedVersion = argv[++i].trim();
        } else if (argv[i] === '--merge-catalog' && argv[i + 1]) {
            opts.mergeCatalog = path.resolve(argv[++i]);
        }
    }
    return opts;
}

function verifyPackage(tgzPath, expectedId, expectedVersion) {
    const stat = fs.statSync(tgzPath);
    if (stat.size > 32 * 1024 * 1024) {
        throw new Error(`${path.basename(tgzPath)} exceeds MGU Store 32 MiB limit (${stat.size} bytes)`);
    }
    const listing = execFileSync('tar', ['-tzf', tgzPath], { encoding: 'utf8' });
    const lines = listing.split(/\r?\n/).filter(Boolean);
    const sdkFiles = lines.filter((l) => l.includes('node_modules/oap-sdk'));
    if (sdkFiles.length > 0) {
        throw new Error(`${path.basename(tgzPath)} contains non-redistributable oap-sdk files: ${sdkFiles.join(', ')}`);
    }
    const pkgEntry = lines.includes('package/package.json')
        ? 'package/package.json'
        : (lines.includes('package.json') ? 'package.json' : null);
    if (!pkgEntry) {
        throw new Error(`${path.basename(tgzPath)} is missing package.json`);
    }
    const pkgRaw = execFileSync('tar', ['-xOzf', tgzPath, pkgEntry], { encoding: 'utf8' });
    const pkg = JSON.parse(pkgRaw);
    if (pkg.name !== expectedId) {
        throw new Error(`${path.basename(tgzPath)} package.json name=${JSON.stringify(pkg.name)} !== ${expectedId}`);
    }
    if (pkg.version !== expectedVersion) {
        throw new Error(`${path.basename(tgzPath)} package.json version=${JSON.stringify(pkg.version)} !== ${expectedVersion}`);
    }
    if (!pkg.main || typeof pkg.main !== 'string') {
        throw new Error(`${path.basename(tgzPath)} package.json is missing required "main" field (AppPackageJsonVerifier would reject install)`);
    }
    const prefix = pkgEntry.startsWith('package/') ? 'package/' : '';
    const mainEntry = prefix + pkg.main.replace(/^\.\//, '');
    if (!lines.includes(mainEntry)) {
        throw new Error(`${path.basename(tgzPath)} is missing main entry ${mainEntry}`);
    }
    if (pkg.private !== false) {
        throw new Error(`${path.basename(tgzPath)} package.json must set "private": false`);
    }
    if (!pkg.author || !pkg.license) {
        throw new Error(`${path.basename(tgzPath)} package.json must set "author" and "license"`);
    }
    if (!pkg.oapAppSettings || !pkg.oapAppSettings.someipManifest) {
        throw new Error(`${path.basename(tgzPath)} package.json is missing oapAppSettings.someipManifest`);
    }
}

function main() {
    const opts = parseArgs(process.argv);
    const repoDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'mgu-repo.json'), 'utf8'));
    if (repoDoc.schema !== 1 || !Array.isArray(repoDoc.components)) {
        throw new Error('mgu-repo.json must have schema: 1 and components[]');
    }

    let existingComponents = [];
    if (opts.mergeCatalog) {
        if (!fs.existsSync(opts.mergeCatalog)) {
            throw new Error(`--merge-catalog file not found: ${opts.mergeCatalog}`);
        }
        const existing = JSON.parse(fs.readFileSync(opts.mergeCatalog, 'utf8'));
        if (existing.schema !== 2 || !Array.isArray(existing.components)) {
            throw new Error(`--merge-catalog ${opts.mergeCatalog} must be a Schema 2 catalog with components[]`);
        }
        existingComponents = existing.components;
    }

    let selectedComponents = repoDoc.components;
    if (opts.only.length > 0) {
        const wanted = new Set(opts.only);
        const known = new Set(repoDoc.components.map((rc) => rc.id));
        const unknown = [...wanted].filter((id) => !known.has(id));
        if (unknown.length > 0) {
            throw new Error(`Unknown --only component id(s): ${unknown.join(', ')} (available: ${[...known].join(', ')})`);
        }
        selectedComponents = repoDoc.components.filter((rc) => wanted.has(rc.id));
    }
    if (opts.expectedVersion && selectedComponents.length !== 1) {
        throw new Error(`--expected-version requires exactly 1 selected component (got ${selectedComponents.length})`);
    }

    fs.rmSync(opts.outDir, { recursive: true, force: true });
    fs.mkdirSync(opts.outDir, { recursive: true });

    let headCommit = null;
    try {
        headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (_) {
        headCommit = null;
    }

    const builtComponents = [];
    const storeApps = {};

    for (const rc of selectedComponents) {
        if (rc.kind !== 'app') {
            throw new Error(`Unsupported component kind in build_catalog.js: ${rc.kind}`);
        }
        const compDir = path.join(ROOT, rc.path);
        const manifestFile = path.join(compDir, rc.manifest || 'app.json');
        if (!fs.existsSync(manifestFile)) {
            throw new Error(`Missing manifest ${manifestFile} (did you run 'git submodule update --init --recursive'?)`);
        }
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const id = rc.id;
        const version = manifest.version;
        if (opts.expectedVersion && version !== opts.expectedVersion) {
            throw new Error(`${id}: manifest version ${version} !== expected tag version ${opts.expectedVersion}`);
        }
        const vars = { id, version, dir: rc.path };

        if (!rc.build || !rc.build.python) {
            throw new Error(`${id}: expected build.python in mgu-repo.json`);
        }
        const appRepoRoot = path.resolve(compDir, '..', '..');
        if (fs.existsSync(path.join(appRepoRoot, 'package-lock.json')) && !fs.existsSync(path.join(appRepoRoot, 'node_modules'))) {
            execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: appRepoRoot, stdio: 'inherit' });
        }
        const pyScript = path.join(ROOT, rc.build.python);
        const pyArgs = [pyScript, '--omit-sdk'].concat((rc.build.args || []).map((a) => fill(a, vars)));
        execFileSync('python3', pyArgs, { cwd: ROOT, stdio: 'inherit' });

        const builtTgz = path.join(ROOT, fill(rc.build.output, vars));
        if (!fs.existsSync(builtTgz)) {
            throw new Error(`${id}: expected build output at ${builtTgz}`);
        }
        verifyPackage(builtTgz, id, version);

        const artifactName = `${id}@${version}.tgz`;
        const destTgz = path.join(opts.outDir, artifactName);
        fs.copyFileSync(builtTgz, destTgz);

        // Clean nested submodule dist/ so git status stays clean after catalog builds
        const subDistDir = path.dirname(builtTgz);
        fs.rmSync(subDistDir, { recursive: true, force: true });

        const size = fs.statSync(destTgz).size;
        const sha256 = sha256File(destTgz);
        const artifactUrl = opts.baseUrl ? `${opts.baseUrl}/${artifactName}` : artifactName;

        let iconName = null;
        let iconSha256 = null;
        const srcIcon = path.join(compDir, rc.icon || 'icon.png');
        if (fs.existsSync(srcIcon)) {
            const iconStat = fs.statSync(srcIcon);
            if (iconStat.size > 128 * 1024) {
                throw new Error(`${id}: icon ${srcIcon} exceeds 128 KiB Store limit`);
            }
            iconName = `${id}.png`;
            const destIcon = path.join(opts.outDir, iconName);
            fs.copyFileSync(srcIcon, destIcon);
            iconSha256 = sha256File(destIcon);
        }

        const title = rc.title || manifest.title || id;
        const description = rc.description || manifest.description || '';
        const mguHmi = rc.mguHmi || manifest.mguHmi || ['ID7'];
        const requires = rc.requires || manifest.requires || undefined;

        const entry = {
            id,
            kind: 'app',
            title,
            description,
            author: opts.author,
            version,
            artifact: {
                name: artifactName,
                size,
                sha256,
                url: artifactUrl,
            },
            uninstallable: rc.uninstallable !== false,
            mguHmi,
        };
        if (requires && Object.keys(requires).length > 0) {
            entry.requires = requires;
        }
        if (iconName) {
            entry.icon = iconName;
            entry.iconSha256 = iconSha256;
        }
        builtComponents.push(entry);

        storeApps[id] = {
            title,
            description,
            author: opts.author,
        };
        if (iconName) {
            storeApps[id].icon = iconName;
            storeApps[id].iconSha256 = iconSha256;
        }
    }

    let catalogComponents = builtComponents;
    if (existingComponents.length > 0) {
        const builtById = new Map(builtComponents.map((entry) => [entry.id, entry]));
        const seen = new Set();
        catalogComponents = existingComponents.map((entry) => {
            if (builtById.has(entry.id)) {
                seen.add(entry.id);
                return builtById.get(entry.id);
            }
            return entry;
        });
        for (const entry of builtComponents) {
            if (!seen.has(entry.id)) {
                catalogComponents.push(entry);
            }
        }
    }

    const catalog = {
        schema: 2,
        ...(headCommit ? { commit: headCommit } : {}),
        components: catalogComponents,
    };
    fs.writeFileSync(path.join(opts.outDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
    fs.writeFileSync(path.join(opts.outDir, 'mgu-store.json'), JSON.stringify({ apps: storeApps }, null, 2) + '\n');

    console.log(`Built MGU Store catalog (${builtComponents.length} built, ${catalogComponents.length} total component(s)) in ${path.relative(ROOT, opts.outDir) || '.'}`);
}

main();
