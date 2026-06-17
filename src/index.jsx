import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { App } from "./panels/App.jsx";
import { LegacyToolsApp } from "./panels/LegacyToolsApp.jsx";

import { entrypoints, shell } from "uxp";

const ABOUT_WEBSITE_URL = "https://www.mekomedia.vn/p/meko-banana-pro.html";

const appController = new PanelController(() => <App/>, { id: "demos", menuItems: [
    { id: "reload1", label: "Reload Panel", enabled: true, checked: false, oninvoke: () => appController.reload() }
] });

const legacyToolsController = new PanelController(() => <LegacyToolsApp/>, { id: "legacyTools", menuItems: [
    { id: "reloadLegacyTools", label: "Reload Retouch Tools", enabled: true, checked: false, oninvoke: () => legacyToolsController.reload() }
] });

const openAboutWebsite = async () => {
    await shell.openExternal(ABOUT_WEBSITE_URL);
};

const openLegacyToolsPanel = () => {
    const panel = entrypoints && typeof entrypoints.getPanel === "function"
        ? entrypoints.getPanel("legacyTools")
        : null;

    if (panel && typeof panel.show === "function") {
        panel.show();
    }
};

entrypoints.setup({
    plugin: {
        create(plugin) {
            console.log("created", plugin);
        },
        destroy() {
            console.log("destroyed");
        }
    },
    commands: {
        showAbout: openAboutWebsite,
        openLegacyTools: openLegacyToolsPanel
    },
    panels: {
        demos: appController,
        legacyTools: legacyToolsController
    }
});
