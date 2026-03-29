const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const pluginManifestPath = path.join(rootDir, "plugin", "manifest.json");
const distDir = path.join(rootDir, "dist");
const distManifestPath = path.join(distDir, "manifest.json");

const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const readJson = (filePath) => {
    if (!fs.existsSync(filePath)) {
        fail(`Missing file: ${filePath}`);
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        fail(`Invalid JSON in ${filePath}: ${error.message}`);
        return null;
    }
};

const ensureDistFileExists = (relativePath) => {
    const targetPath = path.join(distDir, relativePath);
    if (!fs.existsSync(targetPath)) {
        fail(`Missing dist asset: ${relativePath}`);
    }
};

const pluginManifest = readJson(pluginManifestPath);
const distManifest = readJson(distManifestPath);

if (pluginManifest) {
    if (!pluginManifest.id || typeof pluginManifest.id !== "string") {
        fail("manifest.id is required.");
    } else if (/^test-/i.test(pluginManifest.id) || pluginManifest.id === "Test-j0n49y") {
        warn("manifest.id is still using a test placeholder. Replace it with your Adobe Developer Distribution ID before external distribution.");
    }

    if (!pluginManifest.name || typeof pluginManifest.name !== "string") {
        fail("manifest.name is required.");
    }

    if (!pluginManifest.version || typeof pluginManifest.version !== "string") {
        fail("manifest.version is required.");
    }

    if (pluginManifest.main !== "index.html") {
        warn(`manifest.main is "${pluginManifest.main}". This project expects "index.html".`);
    }

    if (!pluginManifest.host || pluginManifest.host.app !== "PS") {
        fail("This release check expects host.app to be \"PS\".");
    }

    if (!Array.isArray(pluginManifest.entrypoints) || pluginManifest.entrypoints.length === 0) {
        fail("manifest.entrypoints must contain at least one command or panel.");
    }
}

if (distManifest && pluginManifest) {
    if (distManifest.id !== pluginManifest.id) {
        fail("dist/manifest.json is out of sync with plugin/manifest.json (id mismatch). Rebuild before packaging.");
    }

    if (distManifest.version !== pluginManifest.version) {
        fail("dist/manifest.json is out of sync with plugin/manifest.json (version mismatch). Rebuild before packaging.");
    }
}

["index.html", "index.js", "manifest.json", "icons/icon_D.png", "icons/icon_N.png"].forEach(ensureDistFileExists);

if (warnings.length > 0) {
    console.log("CCX prep warnings:");
    warnings.forEach((message) => console.log(`- ${message}`));
    console.log("");
}

if (errors.length > 0) {
    console.error("CCX prep failed:");
    errors.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
}

console.log("CCX prep passed.");
console.log("");
console.log("Next steps:");
console.log("1. Open Adobe UXP Developer Tool.");
console.log(`2. Load the plugin from: ${distManifestPath}`);
console.log("3. Use the plugin Actions menu > Package.");
console.log("4. Choose an output folder to generate the .ccx file.");
