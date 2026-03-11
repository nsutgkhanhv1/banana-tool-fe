import React from "react";

export const TabNavigation = ({ tabs, activeTab, onTabSelect }) => (
    <div className="tab-navigation">
        {tabs.map((tab) => (
            <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => onTabSelect(tab.id)}
            >
                {tab.label}
            </button>
        ))}
    </div>
);
