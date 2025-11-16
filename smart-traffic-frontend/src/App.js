
import React, { useState } from 'react';
import ROIMapper from './ROIMapper';
import Dashboard from './Dashboard';

function App() {
    const [mode, setMode] = useState('home'); // 'home', 'roi', 'dashboard'
    const [useSaved, setUseSaved] = useState(false);

    const renderContent = () => {
        switch (mode) {
            case 'roi':
                return <ROIMapper onConfigured={() => setMode('dashboard')} />;
            case 'dashboard':
                return <Dashboard useSavedLanes={useSaved} />;
            default:
                return (
                    <div className="button-group">
                        <button onClick={() => {
                            setUseSaved(false);
                            setMode('roi');
                        }}>Map New Lanes & Start</button>
                        <button onClick={() => {
                            setUseSaved(true);
                            setMode('dashboard');
                        }}>Go Live (Use Saved Lanes)</button>
                    </div>
                );
        }
    };

    return (
        <div className="App">
            <header className="header">
                <h1>Smart Traffic Control</h1>
            </header>
            <main className="main-content">
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
