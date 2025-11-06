import React, { useState } from 'react';
import DeleteModal from './DeleteModal';
import './EventList.css';

function EventList({ events, onEventDeleted, token }) {
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);

    const handleDeleteClick = (event) => {
        setSelectedEvent(event);
        setDeleteModalOpen(true);
    };

    const handleConfirmDeleteSingle = async (eventId) => {
        try {
            await onEventDeleted(eventId, 'single');
        } catch (err) {
            console.error('Error deleting event occurrence:', err);
        }
    };

    const handleConfirmDeleteAll = async (eventId) => {
        try {
            await onEventDeleted(eventId, 'all');
        } catch (err) {
            console.error('Error deleting all event occurrences:', err);
        }
    };

    if (events.length === 0) {
        return <div className="no-events">No events scheduled yet. Create one in the Create tab!</div>;
    }

    return (
        <>
            <div className="event-list">
                <h2>Your Scheduled Events</h2>
                <table className="events-table">
                    <thead>
                        <tr>
                            <th>Class Name</th>
                            <th>Location</th>
                            <th>Time Slot</th>
                            <th>Days</th>
                            <th>Date Range</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {events.map(event => (
                            <tr key={event.event_id}>
                                <td>{event.class_name}</td>
                                <td>{event.location}</td>
                                <td>{event.time_slot}</td>
                                <td>{event.days}</td>
                                <td>{event.start_date} to {event.end_date}</td>
                                <td>
                                    <button 
                                        className="delete-btn"
                                        onClick={() => handleDeleteClick(event)}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <DeleteModal 
                event={selectedEvent}
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setSelectedEvent(null);
                }}
                onConfirmSingle={handleConfirmDeleteSingle}
                onConfirmAll={handleConfirmDeleteAll}
            />
        </>
    );
}

export default EventList;

