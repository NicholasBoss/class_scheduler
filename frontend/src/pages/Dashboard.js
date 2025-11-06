import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EventList from '../components/EventList';
import EventForm from '../components/EventForm';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Dashboard({ user, token, onLogout }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('create');

    useEffect(() => {
        fetchEvents();
    }, [token]);

    const fetchEvents = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents(response.data);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEventCreated = async (newEvent) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/events`, newEvent, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents([...events, response.data]);
            alert('Event created successfully!');
        } catch (err) {
            console.error('Error creating event:', err);
            alert('Failed to create event');
        }
    };

    const handleEventDeleted = async (eventId, deleteType = 'all') => {
        try {
            const params = deleteType === 'single' ? '?deleteType=single' : '';
            await axios.delete(`${API_BASE_URL}/events/${eventId}${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents(events.filter(e => e.event_id !== eventId));
            alert('Event deleted successfully!');
        } catch (err) {
            console.error('Error deleting event:', err);
            alert('Failed to delete event');
        }
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>📚 Class Scheduler</h1>
                <div className="user-info">
                    <span>Welcome, {user.name}</span>
                    <button className="logout-btn" onClick={onLogout}>Logout</button>
                </div>
            </header>

            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 'create' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create')}
                >
                    Create
                </button>
                <button 
                    className={`tab ${activeTab === 'manage' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manage')}
                >
                    Manage
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'create' && (
                    <EventForm onEventCreated={handleEventCreated} token={token} />
                )}
                {activeTab === 'manage' && (
                    <EventList 
                        events={events} 
                        onEventDeleted={handleEventDeleted}
                        token={token}
                    />
                )}
            </div>
        </div>
    );
}

export default Dashboard;
