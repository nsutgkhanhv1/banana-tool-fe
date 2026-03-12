import React from "react";

export const TabNavigation = ({ tabs, activeTab, disabled, onTabSelect }) => (
    <div className="tab-navigation">
        {tabs.map((tab) => (
            <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                disabled={disabled}
                onClick={() => onTabSelect(tab.id)}
            >
                {tab.label}
            </button>
        ))}
    </div>
);
