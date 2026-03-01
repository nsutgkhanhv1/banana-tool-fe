import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { CommandController } from "./controllers/CommandController.jsx";
import { About } from "./components/About.jsx";
import { App } from "./panels/App.jsx";

import { entrypoints } from "uxp";

const appController = new PanelController(() => <App/>, { id: "demos", menuItems: [
    { id: "reload1", label: "Reload Plugin", enabled: true, checked: false, oninvoke: () => location.reload() }
] });

entrypoints.setup({
    plugin: {
        create(plugin) {
            console.log("created", plugin);
        },
        destroy() {
            console.log("destroyed");
        }
    },
    panels: {
        demos: appController
    }
});
