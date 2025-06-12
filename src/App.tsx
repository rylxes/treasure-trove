// src/App.tsx
import React from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {Navbar} from './components/Navbar';
import {Footer} from './components/Footer';
import {Home} from './pages/Home';
import {Browse} from './pages/Browse';
import {ItemDetails} from './pages/ItemDetails';
import {Profile} from './pages/Profile';
import {Settings} from './pages/Settings';
import {Messages} from './pages/Messages';
import {Notifications} from './pages/Notifications';
import {Auth} from './pages/Auth';
import {CreateListing} from './pages/CreateListing';
import {Admin} from './pages/Admin';
import {Wishlist} from './pages/Wishlist'; // Import the new Wishlist page
import {AuthProvider} from './contexts/AuthContext';
import {Toaster} from './components/ui/Toaster';
import {PriceAlerts} from './pages/PriceAlerts';
import {StockAlerts} from './pages/StockAlerts';
import {SavedSearchAlerts} from './pages/SavedSearchAlerts';
import {MyItems} from "./pages/MyItems.tsx";


function App() {
    return (
        <Router>
            <AuthProvider>
                <div className="min-h-screen bg-gray-50">
                    <Navbar/>
                    <main className="container mx-auto px-4 py-8">
                        <Routes>
                            <Route path="/" element={<Home/>}/>
                            <Route path="/browse" element={<Browse/>}/>
                            <Route path="/items/:id" element={<ItemDetails/>}/>
                            <Route path="/profile/:id" element={<Profile/>}/>
                            <Route path="/settings" element={<Settings/>}/>
                            <Route path="/messages" element={<Messages/>}/>
                            <Route path="/notifications" element={<Notifications/>}/>
                            <Route path="/auth" element={<Auth/>}/>
                            <Route path="/create-listing" element={<CreateListing/>}/>
                            <Route path="/admin" element={<Admin/>}/>
                            <Route path="/wishlist" element={<Wishlist/>}/>
                            <Route path="/price-alerts"
                                   element={<PriceAlerts/>}/>
                            <Route path="/stock-alerts" element={<StockAlerts/>}/>
                            <Route path="/saved-search-alerts" element={<SavedSearchAlerts/>}/>
                            <Route path="/my-items" element={<MyItems />} />
                        </Routes>
                    </main>
                    <Footer/>
                    <Toaster/>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;