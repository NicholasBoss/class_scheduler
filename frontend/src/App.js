import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './css/base.css';
import './css/larger.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            verifyToken();
        } else {
            setLoading(false);
        }
    }, [token]);

    const verifyToken = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data.user);
        } catch (err) {
            console.error('Token verification failed:', err);
            localStorage.removeItem('token');
            setToken(null);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (newToken, userData) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <Router>
            <Routes>
                <Route 
                    path="/login" 
                    element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} 
                />
                <Route
                    path="/dashboard"
                    element={user ? <Dashboard user={user} token={token} onLogout={handleLogout} /> : <Navigate to="/login" />}
                />
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
            </Routes>
        </Router>
    );
}

export default App;
