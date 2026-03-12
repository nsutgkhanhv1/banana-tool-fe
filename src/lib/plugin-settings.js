const PLUGIN_SETTINGS_STORAGE_KEY = "banana-tool.plugin.settings.v1";

export const DEFAULT_PLUGIN_SETTINGS = {
    toastMode: "compact"
};

const getStorage = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }

    return window.localStorage;
};

export const readPluginSettings = () => {
    const storage = getStorage();
    if (!storage) {
        return { ...DEFAULT_PLUGIN_SETTINGS };
    }

    const raw = storage.getItem(PLUGIN_SETTINGS_STORAGE_KEY);
    if (!raw) {
        return { ...DEFAULT_PLUGIN_SETTINGS };
    }

    try {
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_PLUGIN_SETTINGS,
            ...(parsed && typeof parsed === "object" ? parsed : {})
        };
    } catch (error) {
        return { ...DEFAULT_PLUGIN_SETTINGS };
    }
};

export const persistPluginSettings = (settings) => {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    storage.setItem(PLUGIN_SETTINGS_STORAGE_KEY, JSON.stringify({
        ...DEFAULT_PLUGIN_SETTINGS,
        ...(settings || {})
    }));
};
