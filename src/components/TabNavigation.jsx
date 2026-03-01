import React from "react";

export const TabNavigation = ({ activeTab, setActiveTab }) => {
    return (
        <div className="tab-navigation">
            <button 
                className={`tab-btn ${activeTab === 'thaynen' ? 'active' : ''}`}
                onClick={() => setActiveTab('thaynen')}
            >
                Thay Nền
            </button>
            <button 
                className={`tab-btn ${activeTab === 'phucche' ? 'active' : ''}`}
                onClick={() => setActiveTab('phucche')}
            >
                Phục chế ảnh
            </button>
            <button 
                className={`tab-btn ${activeTab === 'tudoai' ? 'active' : ''}`}
                onClick={() => setActiveTab('tudoai')}
            >
                Tự do AI
            </button>
        </div>
    );
};
