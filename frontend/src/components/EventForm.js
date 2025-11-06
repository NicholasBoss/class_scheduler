import React, { useState } from 'react';
import './EventForm.css';

function EventForm({ onEventCreated, token }) {
    const [semester, setSemester] = useState('Fall');
    const [beginDate, setBeginDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [numClasses, setNumClasses] = useState(1);
    const [classes, setClasses] = useState([]);

    const handleSemesterChange = (e) => {
        const sem = e.target.value;
        setSemester(sem);
        
        const currentYear = new Date().getFullYear();
        let start, end;

        if (sem === 'Fall') {
            start = `${currentYear}-09-01`;
            end = `${currentYear}-12-31`;
        } else if (sem === 'Winter') {
            start = `${currentYear}-01-01`;
            end = `${currentYear}-04-30`;
        } else if (sem === 'Spring') {
            start = `${currentYear}-04-01`;
            end = `${currentYear}-07-31`;
        }

        setBeginDate(start);
        setEndDate(end);
    };

    const handleClassChange = (index, field, value) => {
        const newClasses = [...classes];
        if (!newClasses[index]) newClasses[index] = {};
        newClasses[index][field] = value;
        setClasses(newClasses);
    };

    const handleGenerateSchedule = () => {
        if (!beginDate || !endDate) {
            alert('Please select a date range');
            return;
        }

        for (let i = 0; i < numClasses; i++) {
            const classData = classes[i];
            if (!classData?.className || !classData?.days || !classData?.timeSlot) {
                alert(`Please fill in all fields for class ${i + 1}`);
                return;
            }

            onEventCreated({
                class_name: classData.className,
                location: classData.location,
                time_slot: classData.timeSlot,
                days: classData.days.join(','),
                start_date: beginDate,
                end_date: endDate,
                google_event_id: null
            });
        }
    };

    return (
        <div className="event-form">
            <h2>Create Schedule</h2>

            <div className="form-group">
                <label>Semester:</label>
                <select value={semester} onChange={handleSemesterChange}>
                    <option>Fall</option>
                    <option>Winter</option>
                    <option>Spring</option>
                </select>
            </div>

            <div className="date-range">
                <div className="form-group">
                    <h3>Please Fine Tune Your Dates to Be Within the Semester:</h3>

                    <label>Start Date:</label>
                    <input type="date" value={beginDate} onChange={(e) => setBeginDate(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>End Date:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>

            <div className="form-group">
                <label>Number of Classes:</label>
                <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={numClasses}
                    onChange={(e) => setNumClasses(parseInt(e.target.value))}
                />
            </div>

            <div className="classes-container">
                {Array.from({ length: numClasses }).map((_, i) => (
                    <div key={i} className="class-form">
                        <h3>Class {i + 1}</h3>
                        <div className="form-group">
                            <label>Class Name:</label>
                            <input 
                                type="text" 
                                placeholder="e.g., CSE 101"
                                onChange={(e) => handleClassChange(i, 'className', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Location:</label>
                            <input 
                                type="text" 
                                placeholder="e.g., MC 101"
                                onChange={(e) => handleClassChange(i, 'location', e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label>Days:</label>
                            <div className="days-select">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                    <label key={day}>
                                        <input 
                                            type="checkbox"
                                            onChange={(e) => {
                                                const days = classes[i]?.days || [];
                                                if (e.target.checked) {
                                                    handleClassChange(i, 'days', [...days, day]);
                                                } else {
                                                    handleClassChange(i, 'days', days.filter(d => d !== day));
                                                }
                                            }}
                                        />
                                        {day}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Time Slot:</label>
                            <select onChange={(e) => handleClassChange(i, 'timeSlot', e.target.value)}>
                                <option value="">Select time</option>
                                <option>7:45 AM - 8:45 AM</option>
                                <option>9:00 AM - 10:00 AM</option>
                                <option>10:15 AM - 11:15 AM</option>
                                <option>11:30 AM - 12:30 PM</option>
                                <option>12:45 PM - 1:45 PM</option>
                                <option>2:00 PM - 3:00 PM</option>
                                <option>3:15 PM - 4:15 PM</option>
                                <option>4:30 PM - 5:30 PM</option>
                            </select>
                        </div>
                    </div>
                ))}
            </div>

            <button className="submit-btn" onClick={handleGenerateSchedule}>
                Generate Schedule
            </button>
        </div>
    );
}

export default EventForm;
