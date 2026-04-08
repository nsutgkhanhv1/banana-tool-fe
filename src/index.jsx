import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { App } from "./panels/App.jsx";

import { entrypoints, shell } from "uxp";

const ABOUT_WEBSITE_URL = "https://www.mekomedia.vn/p/meko-banana-pro.html";

const appController = new PanelController(() => <App/>, { id: "demos", menuItems: [
    { id: "reload1", label: "Reload Plugin", enabled: true, checked: false, oninvoke: () => location.reload() }
] });

const openAboutWebsite = async () => {
    await shell.openExternal(ABOUT_WEBSITE_URL);
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
        showAbout: openAboutWebsite
    },
    panels: {
        demos: appController
    }
});
