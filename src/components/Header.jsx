import React, { useEffect, useRef, useState } from "react";
import { PLUGIN_DISPLAY_NAME } from "../lib/plugin-config.js";

const AUTHENTICATED_MENU_ITEMS = [
    { id: "account", label: "TÀI KHOẢN" },
    { id: "history", label: "LỊCH SỬ" },
    { id: "purchase", label: "MUA GÓI" },
    { id: "settings", label: "CÀI ĐẶT" },
    { id: "support", label: "NHÓM ZALO SUPPORT" },
    { id: "logout", label: "ĐĂNG XUẤT" }
];

const GUEST_MENU_ITEMS = [
    { id: "account", label: "ĐĂNG NHẬP" },
    { id: "purchase", label: "MUA GÓI" }
];

export const Header = ({ userSummary, planSummary, creditSummary, refreshStatus, actionsDisabled, onAction }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const isAuthenticated = userSummary.identifier !== "Chưa đăng nhập";
    const menuItems = isAuthenticated ? AUTHENTICATED_MENU_ITEMS : GUEST_MENU_ITEMS;

    useEffect(() => {
        if (!menuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    const handleMenuAction = (action) => {
        if (actionsDisabled) {
            return;
        }

        setMenuOpen(false);
        onAction(action);
    };

    return (
        <div className="header-container">
            <div className="brand-banner">
                <h1>MEKO BANANA PRO</h1>
            </div>
            
            <div className="header-toolbar">
                <div className="header-controls">
                    <button
                        className={`btn-pill credit-btn entitlement-${creditSummary.severity || "neutral"}`}
                        onClick={() => onAction("credit-subscription")}
                        title="Xem Credit & Subscription"
                        disabled={actionsDisabled}
                    >
                        <span>Credit:{creditSummary.usageText}</span>
                    </button>

                    <button className="btn-pill" onClick={() => onAction("refresh")} title="Làm mới plugin" disabled={actionsDisabled}>
                        <svg className={refreshStatus === "refreshing" ? "spinner" : ""} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>{refreshStatus === "refreshing" ? "Đang làm mới" : "Làm mới"}</span>
                    </button>

                    <div className="account-dropdown-wrapper" ref={menuRef}>
                        <button className="btn-pill account-trigger" onClick={() => !actionsDisabled && setMenuOpen((value) => !value)} disabled={actionsDisabled}>
                            <span className="account-identifier">{userSummary.identifier}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        {menuOpen ? (
                            <div className="account-dropdown">
                                {menuItems.map((item) => (
                                    <button
                                        key={item.id}
                                        className="account-dropdown-item"
                                        onClick={() => handleMenuAction(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};
