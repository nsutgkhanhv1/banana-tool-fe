import React, { useState } from "react";
import { Header } from "../components/Header.jsx";
import { TabNavigation } from "../components/TabNavigation.jsx";
import { ThayNenTab } from "./tabs/ThayNenTab.jsx";
import { PhucCheTab } from "./tabs/PhucCheTab.jsx";
import { TuDoAITab } from "./tabs/TuDoAITab.jsx";

export const App = () => {
    const [activeTab, setActiveTab] = useState("thaynen");

    return (
        <div className="app-container">
            <Header />
            <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
            <div className="tab-content">
                {activeTab === "thaynen" && <ThayNenTab />}
                {activeTab === "phucche" && <PhucCheTab />}
                {activeTab === "tudoai" && <TuDoAITab />}
            </div>
        </div>
    );
};
