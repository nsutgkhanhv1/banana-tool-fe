import manifest from "../../plugin/manifest.json";

import { API_BASE_URL } from "./api.js";

export const PLUGIN_DISPLAY_NAME = "Meko Media AI";
export const PLUGIN_SUPPORT_CONTACT = "[EMAIL_ADDRESS]";
export const PLUGIN_SUPPORT_LINK = `mailto:${PLUGIN_SUPPORT_CONTACT}`;

export const getPluginVersion = () => {
    if (manifest && manifest.version) {
        return manifest.version;
    }

    return "Chưa có dữ liệu";
};

export const getPluginEnvironmentSummary = (apiBaseUrl = API_BASE_URL) => {
    const baseUrl = typeof apiBaseUrl === "string" ? apiBaseUrl.trim() : "";

    if (!baseUrl) {
        return {
            label: "Chưa có dữ liệu",
            detail: ""
        };
    }

    if (/localhost|127\.0\.0\.1/i.test(baseUrl)) {
        return {
            label: "Local",
            detail: baseUrl
        };
    }

    if (/staging|stage|dev|test/i.test(baseUrl)) {
        return {
            label: "Staging",
            detail: baseUrl
        };
    }

    if (/^https:\/\//i.test(baseUrl)) {
        return {
            label: "Production",
            detail: baseUrl
        };
    }

    return {
        label: "Custom",
        detail: baseUrl
    };
};
