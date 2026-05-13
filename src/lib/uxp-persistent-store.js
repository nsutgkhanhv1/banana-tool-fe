const STORE_FILE_NAME = "banana-tool-shell-store.json";

const getDataFolder = async () => {
    try {
        const storage = require("uxp").storage;
        return storage.localFileSystem.getDataFolder();
    } catch (error) {
        return null;
    }
};

const findStoreFile = async (dataFolder) => {
    const entries = await dataFolder.getEntries();
    return entries.find((entry) => entry && entry.isFile && entry.name === STORE_FILE_NAME) || null;
};

const readStore = async () => {
    const dataFolder = await getDataFolder();
    if (!dataFolder) {
        return {};
    }

    try {
        const file = await findStoreFile(dataFolder);
        if (!file) {
            return {};
        }

        const raw = await file.read();
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        return {};
    }
};

const writeStore = async (store) => {
    const dataFolder = await getDataFolder();
    if (!dataFolder) {
        return;
    }

    const file = await dataFolder.createFile(STORE_FILE_NAME, { overwrite: true });
    await file.write(JSON.stringify(store || {}));
};

export const readPersistentValue = async (key) => {
    const store = await readStore();
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
};

export const writePersistentValue = async (key, value) => {
    const store = await readStore();
    store[key] = value;
    await writeStore(store);
};

export const removePersistentValue = async (key) => {
    const store = await readStore();
    delete store[key];
    await writeStore(store);
};
