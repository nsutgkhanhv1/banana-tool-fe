import ReactDOM from "react-dom";

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _Component = Symbol("_Component");
const _menuItems = Symbol("_menuItems");

export class PanelController {
    
    constructor(Component, { id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_Component] = null;
        this[_menuItems] = [];

        this[_Component] = Component;
        this[_id] = id;
        this[_menuItems] = menuItems || [];
        this.menuItems = this[_menuItems].map(menuItem => ({
            id: menuItem.id,
            label: menuItem.label,
            enabled: menuItem.enabled || true,
            checked: menuItem.checked || false
        }));

        [ "create", "show", "hide", "destroy", "reload", "invokeMenu" ].forEach(fn => this[fn] = this[fn].bind(this));
    }

    create() {
        if (this[_root]) {
            ReactDOM.unmountComponentAtNode(this[_root]);
        }

        this[_root] = document.createElement("div");
        this[_root].style.height = "100vh";
        this[_root].style.overflow = "auto";
        this[_root].style.padding = "8px";

        ReactDOM.render(this[_Component]({panel: this}), this[_root]);

        return this[_root];
    }

    show(event)  {
        if (!this[_root] || this[_root].ownerDocument !== document) this.create();
        this[_attachment] = event;
        if (this[_root].parentNode !== this[_attachment]) {
            this[_attachment].appendChild(this[_root]);
        }
        window.dispatchEvent(new CustomEvent("banana-tool:panel-show", {
            detail: {
                panelId: this[_id]
            }
        }));
    }

    hide() {
        if (this[_attachment] && this[_root] && this[_root].parentNode === this[_attachment]) {
            this[_attachment].removeChild(this[_root]);
            this[_attachment] = null;
        }
    }

    destroy() {
        if (this[_root]) {
            ReactDOM.unmountComponentAtNode(this[_root]);
            if (this[_root].parentNode) {
                this[_root].parentNode.removeChild(this[_root]);
            }
        }

        this[_root] = null;
        this[_attachment] = null;
    }

    reload() {
        const attachment = this[_attachment];
        this.destroy();

        if (attachment) {
            this.show(attachment);
        }
    }

    invokeMenu(id) {
        const menuItem = this[_menuItems].find(c => c.id === id);
        if (menuItem) {
            const handler = menuItem.oninvoke;
            if (handler) {
                handler();
            }
        }
    }
}
