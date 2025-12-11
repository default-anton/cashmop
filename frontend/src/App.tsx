import { useState } from 'react';

function App() {
    return (
        <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold mb-4">Cashflow Tracker</h1>
            <div className="p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
                Drag and drop bank CSV here
            </div>
        </div>
    );
}

export default App;
