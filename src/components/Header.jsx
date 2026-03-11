import React, { useEffect, useRef, useState } from "react";

const AUTHENTICATED_MENU_ITEMS = [
    { id: "account", label: "Tài khoản" },
    { id: "history", label: "Lịch sử" },
    { id: "settings", label: "Cài đặt" },
    { id: "purchase", label: "Mua gói" },
    { id: "logout", label: "Đăng xuất" }
];

const GUEST_MENU_ITEMS = [
    { id: "account", label: "Đăng nhập" },
    { id: "purchase", label: "Mua gói" }
];

export const Header = ({ userSummary, planSummary, creditSummary, refreshStatus, onAction }) => {
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
        setMenuOpen(false);
        onAction(action);
    };

    return (
        <div className="header">
            <div className="header-brand">
                <div className="logo-wrapper">
                    <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                </div>
                <div className="brand-copy">
                    <span className="brand-title">Nano AI <span className="brand-badge">PRO</span></span>
                    <span className="brand-subtitle">Plugin shell & điều hướng</span>
                </div>
            </div>

            <div className="header-controls">
                <div className="plan-chip">
                    <span className="chip-label">Gói</span>
                    <strong>{planSummary.name}</strong>
                    <small>{planSummary.status}</small>
                </div>

                <div className="credits">
                    <div className="credits-dot"></div>
                    <div className="credits-copy">
                        <span>{creditSummary.label}</span>
                        <small>{creditSummary.detail}</small>
                    </div>
                </div>

                <button className="btn" onClick={() => onAction("purchase")}>
                    Mua gói
                </button>

                <button className="btn" onClick={() => onAction("history")}>
                    Lịch sử
                </button>

                <button className="btn icon-with-label" onClick={() => onAction("refresh")} title="Làm mới shell">
                    <svg className={refreshStatus === "refreshing" ? "spinner" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                    <span>{refreshStatus === "refreshing" ? "Đang làm mới" : "Refresh"}</span>
                </button>

                <div className="account-menu" ref={menuRef}>
                    <button className="account-trigger" onClick={() => setMenuOpen((value) => !value)}>
                        <div className="account-trigger-copy">
                            <strong>{userSummary.displayName}</strong>
                            <span>{userSummary.identifier}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    );
};
