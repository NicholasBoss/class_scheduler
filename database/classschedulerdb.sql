DROP TABLE IF EXISTS semester_calendars;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS account;
DROP TYPE IF EXISTS account_type;


-- Account Type Creation
CREATE TYPE account_type AS ENUM
('User', 'Admin', 'DBA');

-- -----------------------------------------------------
-- Table account
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS account 
(
  account_id SERIAL,
  account_firstname CHARACTER VARYING,
  account_lastname CHARACTER VARYING,
  account_email CHARACTER VARYING NOT NULL UNIQUE,
  account_password CHARACTER VARYING,
  google_id CHARACTER VARYING UNIQUE,
  google_access_token CHARACTER VARYING,
  account_type account_type NOT NULL DEFAULT 'User'::account_type,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  CONSTRAINT account_pk PRIMARY KEY (account_id)
);

CREATE TABLE IF NOT EXISTS events 
(
    event_id SERIAL,
    class_name CHARACTER VARYING NOT NULL,
    location CHARACTER VARYING,
    time_slot CHARACTER VARYING NOT NULL,
    days CHARACTER VARYING NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    account_id INT NOT NULL,
    google_event_id CHARACTER VARYING UNIQUE,
    recurrence_rule CHARACTER VARYING,
    semester_name CHARACTER VARYING,
    CONSTRAINT events_pk PRIMARY KEY (event_id),
    CONSTRAINT events_fk1 FOREIGN KEY (account_id) REFERENCES account(account_id) 
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Semester calendars table for storing separate Google Calendar mappings
CREATE TABLE IF NOT EXISTS semester_calendars
(
    calendar_id SERIAL,
    account_id INT NOT NULL,
    semester_name CHARACTER VARYING NOT NULL,
    google_calendar_id CHARACTER VARYING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT semester_calendars_pk PRIMARY KEY (calendar_id),
    CONSTRAINT semester_calendars_fk1 FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT semester_calendars_unique UNIQUE (account_id, semester_name)
);