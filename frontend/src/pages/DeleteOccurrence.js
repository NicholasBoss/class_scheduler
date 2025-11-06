import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DeleteOccurrence.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function DeleteOccurrence({ user, token }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedOccurrences, setSelectedOccurrences] = useState([]);
    const [occurrences, setOccurrences] = useState([]);
    const [deleteInProgress, setDeleteInProgress] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, [token]);

    const fetchEvents = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching events:', err);
            setLoading(false);
        }
    };

    // Generate all occurrences of a recurring event
    const generateOccurrences = (event) => {
        const occurrences = [];
        const daysMap = {
            'Monday': 1,
            'Tuesday': 2,
            'Wednesday': 3,
            'Thursday': 4,
            'Friday': 5
        };

        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);
        const selectedDays = event.days.split(',').map(d => d.trim());
        const selectedDayNumbers = selectedDays.map(day => daysMap[day]).filter(Boolean);

        // Generate all dates that fall on the selected days
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (selectedDayNumbers.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) {
                occurrences.push({
                    date: currentDate.toISOString().split('T')[0],
                    displayDate: currentDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                    }),
                    id: `${event.event_id}_${currentDate.toISOString().split('T')[0]}`
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return occurrences;
    };

    const handleSelectEvent = (event) => {
        setSelectedEvent(event);
        setSelectedOccurrences([]);
        const occurrencesList = generateOccurrences(event);
        setOccurrences(occurrencesList);
    };

    const handleToggleOccurrence = (occurrenceId) => {
        setSelectedOccurrences(prev => {
            if (prev.includes(occurrenceId)) {
                return prev.filter(id => id !== occurrenceId);
            } else {
                return [...prev, occurrenceId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedOccurrences.length === occurrences.length) {
            setSelectedOccurrences([]);
        } else {
            setSelectedOccurrences(occurrences.map(o => o.id));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedOccurrences.length === 0) {
            alert('Please select at least one occurrence to delete');
            return;
        }

        const confirmMessage = `Are you sure you want to delete ${selectedOccurrences.length} occurrence(s)?`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        setDeleteInProgress(true);
        try {
            // Extract dates from selected occurrences
            const datesToDelete = selectedOccurrences.map(id => 
                id.split('_')[1] // Extract date part from id
            );

            // Call backend API to delete specific occurrences
            await axios.post(
                `${API_BASE_URL}/events/${selectedEvent.event_id}/delete-occurrences`,
                { dates: datesToDelete },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            alert(`Successfully deleted ${selectedOccurrences.length} occurrence(s)!`);
            setSelectedOccurrences([]);
            
            // Refresh occurrences list
            const updatedOccurrences = generateOccurrences(selectedEvent);
            setOccurrences(updatedOccurrences);
        } catch (err) {
            console.error('Error deleting occurrences:', err);
            alert('Failed to delete occurrences: ' + (err.response?.data?.error || err.message));
        } finally {
            setDeleteInProgress(false);
        }
    };

    if (loading) {
        return <div className="delete-occurrence-container"><p>Loading events...</p></div>;
    }

    if (events.length === 0) {
        return (
            <div className="delete-occurrence-container">
                <div className="no-events-message">
                    <h2>No scheduled events</h2>
                    <p>Create some events first before deleting specific occurrences.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="delete-occurrence-container">
            <h1>🗑️ Delete Specific Class Occurrences</h1>
            
            <div className="delete-occurrence-layout">
                {/* Left Panel - Event List */}
                <div className="event-selection-panel">
                    <h2>Your Classes</h2>
                    <div className="event-list">
                        {events.map((event) => (
                            <div
                                key={event.event_id}
                                className={`event-item ${selectedEvent?.event_id === event.event_id ? 'selected' : ''}`}
                                onClick={() => handleSelectEvent(event)}
                            >
                                <div className="event-item-header">
                                    <h3>{event.class_name}</h3>
                                </div>
                                <div className="event-item-details">
                                    <p><strong>Time:</strong> {event.time_slot}</p>
                                    <p><strong>Days:</strong> {event.days}</p>
                                    <p><strong>Location:</strong> {event.location}</p>
                                    <p className="date-range">
                                        <strong>Dates:</strong> {event.start_date} to {event.end_date}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel - Occurrences List */}
                <div className="occurrences-panel">
                    {selectedEvent ? (
                        <>
                            <h2>Class Occurrences</h2>
                            <div className="selected-event-info">
                                <h3>{selectedEvent.class_name}</h3>
                                <p>{selectedEvent.time_slot} on {selectedEvent.days}</p>
                            </div>

                            <div className="occurrences-controls">
                                <button 
                                    className="select-all-btn"
                                    onClick={handleSelectAll}
                                >
                                    {selectedOccurrences.length === occurrences.length && occurrences.length > 0
                                        ? 'Deselect All'
                                        : 'Select All'
                                    }
                                </button>
                                <div className="selection-counter">
                                    {selectedOccurrences.length} of {occurrences.length} selected
                                </div>
                            </div>

                            {occurrences.length > 0 ? (
                                <>
                                    <div className="occurrences-list">
                                        {occurrences.map((occurrence) => (
                                            <div
                                                key={occurrence.id}
                                                className={`occurrence-item ${selectedOccurrences.includes(occurrence.id) ? 'selected' : ''}`}
                                                onClick={() => handleToggleOccurrence(occurrence.id)}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOccurrences.includes(occurrence.id)}
                                                    onChange={() => handleToggleOccurrence(occurrence.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="occurrence-date">{occurrence.displayDate}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="occurrences-actions">
                                        <button
                                            className="delete-btn"
                                            onClick={handleDeleteSelected}
                                            disabled={selectedOccurrences.length === 0 || deleteInProgress}
                                        >
                                            {deleteInProgress ? 'Deleting...' : `Delete Selected (${selectedOccurrences.length})`}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="no-occurrences">
                                    <p>No occurrences found for this event.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="no-selection">
                            <p>👈 Select a class from the left to view its occurrences</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DeleteOccurrence;
