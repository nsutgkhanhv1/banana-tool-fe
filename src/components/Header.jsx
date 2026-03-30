import React, { useEffect, useRef, useState } from "react";
import { PLUGIN_DISPLAY_NAME } from "../lib/plugin-config.js";

const AUTHENTICATED_MENU_ITEMS = [
    { id: "account", label: "TÀI KHOẢN" },
    { id: "history", label: "LỊCH SỬ" },
    { id: "purchase", label: "MUA GÓI" },
    { id: "support", label: "NHÓM ZALO SUPPORT" },
    { id: "logout", label: "ĐĂNG XUẤT" }
];

const GUEST_MENU_ITEMS = [
    { id: "account", label: "ĐĂNG NHẬP" },
    { id: "purchase", label: "MUA GÓI" }
];

export const Header = ({ userSummary, planSummary, creditSummary, refreshStatus, actionsDisabled, onAction, isMenuOpen, onMenuToggle }) => {
    const menuRef = useRef(null);
    const isAuthenticated = userSummary.identifier !== "Chưa đăng nhập";
    const menuItems = isAuthenticated ? AUTHENTICATED_MENU_ITEMS : GUEST_MENU_ITEMS;

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onMenuToggle(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen, onMenuToggle]);

    const handleMenuAction = (action) => {
        if (actionsDisabled) {
            return;
        }

        onMenuToggle(false);
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
                    <button className="btn-pill" onClick={() => !actionsDisabled && onMenuToggle(!isMenuOpen)} disabled={actionsDisabled}>
                        <span className="account-identifier">Tài khoản</span>
                    </button>
                    <div className="account-dropdown-wrapper" ref={menuRef}>
                        {isMenuOpen ? (
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
