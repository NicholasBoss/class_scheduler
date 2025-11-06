import React, { useEffect, useState } from 'react';
import '../pages/Dashboard.css';

function DeleteModal({ event, isOpen, onClose, onConfirmSingle, onConfirmAll }) {
    const [occurrences, setOccurrences] = useState([]);
    const [showOccurrences, setShowOccurrences] = useState(false);
    const [selectedOccurrences, setSelectedOccurrences] = useState([]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    useEffect(() => {
        if (event && showOccurrences) {
            generateOccurrences(event);
        }
    }, [event, showOccurrences]);

    const generateOccurrences = (event) => {
        const occurrencesList = [];
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

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (selectedDayNumbers.includes(dayOfWeek === 0 ? 7 : dayOfWeek)) {
                occurrencesList.push({
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

        setOccurrences(occurrencesList);
        setSelectedOccurrences([]);
    };

    const handleClickOutside = (e) => {
        if (e.target.id === 'deleteModal') {
            onClose();
        }
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

    const handleDeleteSpecificOccurrences = async () => {
        if (selectedOccurrences.length === 0) {
            alert('Please select at least one occurrence to delete');
            return;
        }

        const datesToDelete = selectedOccurrences.map(id => id.split('_')[1]);
        
        try {
            const response = await fetch(
                `http://localhost:5000/api/events/${event.event_id}/delete-occurrences`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ dates: datesToDelete })
                }
            );

            if (!response.ok) throw new Error('Failed to delete occurrences');
            
            alert(`Successfully deleted ${selectedOccurrences.length} occurrence(s)!`);
            onClose();
            setShowOccurrences(false);
        } catch (err) {
            console.error('Error:', err);
            alert('Failed to delete occurrences: ' + err.message);
        }
    };

    if (!event) return null;

    return (
        <div 
            id="deleteModal" 
            className={`modal ${isOpen ? 'show' : ''}`}
            onClick={handleClickOutside}
        >
            <div className="delete-modal-content">
                <div className="modal-header">
                    <h2>Delete Class</h2>
                    <span className="close" onClick={onClose}>&times;</span>
                </div>

                {!showOccurrences ? (
                    // Main delete options
                    <div className="delete-modal-body">
                        <p className="delete-warning">⚠️ Are you sure you want to delete this class?</p>
                        
                        <div className="event-summary">
                            <div>
                                <strong>Class:</strong> {event.class_name}
                            </div>
                            {event.time_slot && (
                                <div>
                                    <strong>Time:</strong> {event.time_slot}
                                </div>
                            )}
                            {event.location && (
                                <div>
                                    <strong>Location:</strong> {event.location}
                                </div>
                            )}
                        </div>

                        <h3 className="delete-class-name">{event.class_name}</h3>

                        <div className="delete-options">
                            <div className="delete-option">
                                <button 
                                    className="delete-option-btn single-btn"
                                    onClick={() => setShowOccurrences(true)}
                                >
                                    <span className="btn-icon">📅</span>
                                    <span className="btn-text">Delete Specific Occurrence(s)</span>
                                    <span className="btn-desc">Choose specific dates to remove</span>
                                </button>
                            </div>

                            <div className="delete-option">
                                <button 
                                    className="delete-option-btn all-btn"
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete the entire series?')) {
                                            onConfirmAll(event.event_id);
                                            onClose();
                                        }
                                    }}
                                >
                                    <span className="btn-icon">🗑️</span>
                                    <span className="btn-text">Delete All Occurrences</span>
                                    <span className="btn-desc">Removes entire series</span>
                                </button>
                            </div>
                        </div>

                        <div className="delete-modal-buttons">
                            <button type="button" className="cancel-btn" onClick={onClose}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    // Specific occurrences selection
                    <div className="delete-modal-body">
                        <p className="delete-warning">📅 Select specific occurrences to delete</p>
                        
                        <div className="event-summary">
                            <div>{event.class_name}</div>
                            <div>{event.time_slot}</div>
                        </div>

                        <div className="occurrences-selection">
                            <div className="occurrences-header">
                                <strong>{occurrences.length} Total Occurrences</strong>
                                <span className="selection-info">
                                    {selectedOccurrences.length} selected
                                </span>
                            </div>

                            <div className="occurrences-list-modal">
                                {occurrences.map((occurrence) => (
                                    <div
                                        key={occurrence.id}
                                        className={`occurrence-item-modal ${selectedOccurrences.includes(occurrence.id) ? 'selected' : ''}`}
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

                            <div className="delete-modal-buttons">
                                <button 
                                    type="button" 
                                    className="cancel-btn" 
                                    onClick={() => setShowOccurrences(false)}
                                >
                                    Back
                                </button>
                                <button
                                    className="delete-btn"
                                    onClick={handleDeleteSpecificOccurrences}
                                    disabled={selectedOccurrences.length === 0}
                                >
                                    Delete ({selectedOccurrences.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeleteModal;
