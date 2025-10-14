CREATE TABLE club
(
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    location TEXT,
    logo     VARCHAR(255)
);

CREATE TABLE app_user
(
    id         SERIAL PRIMARY KEY,
    full_name  VARCHAR(255),
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       SMALLINT CHECK (role IN (10, 20)), -- 10=sudo, 20=admin
    club_id    INT REFERENCES club (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event
(
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    description        TEXT,
    location           VARCHAR(255),
    registration_count INT,
    start_datetime     timestampz   NOT NULL,
    end_datetime       timestampz,
    banner             VARCHAR(255),
    landing_config     JSONB,
    config             JSONB,
    slug               VARCHAR(255) UNIQUE,
    currency           VARCHAR(3)   NOT NULL DEFAULT 'USD',
    tax_amount         INT,
    tax_type           VARCHAR(20),
    club_id            INT          NOT NULL REFERENCES club (id) ON DELETE CASCADE,
    created_by         INT          NOT NULL REFERENCES app_user (id)
);

-- Registration table (metadata + primary attendee + additional fields)
CREATE TABLE registration
(
    id                SERIAL PRIMARY KEY,
    event_id          INT NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    additional_fields JSONB,
    user_timezone     VARCHAR(100) DEFAULT 'UTC', --added
    timezone_offset   INT          DEFAULT 0,     --added
    status            BOOLEAN      DEFAULT false,
    created_at        timestampz   DEFAULT NOW(), --updated
    updated_at        TIMESTAMP    DEFAULT NOW()
);

-- Tickets table for different ticket types per event
CREATE TABLE ticket
(
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    description   TEXT,
    price         INT          NOT NULL DEFAULT 0,
    current_stock INT          NOT NULL DEFAULT 0,
    max_stock     INT,
    event_id      INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    created_at    TIMESTAMP             DEFAULT NOW()
);

-- Attendees table (basic attendee data + QR codes)
CREATE TABLE attendees
(
    id              SERIAL PRIMARY KEY,
    registration_id INT                 NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    is_primary      BOOLEAN   DEFAULT false,
    first_name      VARCHAR(255)        NOT NULL,
    last_name       VARCHAR(255)        NOT NULL,
    email           VARCHAR(255)        NOT NULL,
    phone           VARCHAR(50),
    ticket_id       INT REFERENCES ticket (id) ON DELETE CASCADE,
    qr_uuid         VARCHAR(255) UNIQUE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Check-in table (separate for analytics)
CREATE TABLE checkin
(
    id              SERIAL PRIMARY KEY,
    attendee_id     INT NOT NULL REFERENCES attendees (id) ON DELETE CASCADE,
    registration_id INT NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    checked_in_by   INT REFERENCES app_user (id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint after attendees table exists
ALTER TABLE registration
    ADD COLUMN primary_attendee_id INT REFERENCES attendees (id);

-- Indexes for performance
CREATE INDEX idx_attendees_qr_uuid ON attendees (qr_uuid);
CREATE INDEX idx_attendees_registration_id ON attendees (registration_id);
CREATE INDEX idx_attendees_email ON attendees (email);
CREATE INDEX idx_registration_event_id ON registration (event_id);
CREATE INDEX idx_registration_status ON registration (status);
CREATE INDEX idx_checkin_attendee_id ON checkin (attendee_id);
CREATE INDEX idx_checkin_registration_id ON checkin (registration_id);


-- Temporary storage for registration data before payment completion
CREATE TABLE temp_registration
(
    session_id       VARCHAR(255) PRIMARY KEY,
    attendees        JSONB     NOT NULL,
    registration     JSONB     NOT NULL,
    selected_tickets JSONB     NOT NULL,
    orders           JSONB     NOT NULL,
    event_id         INT       NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    created_at       TIMESTAMP DEFAULT NOW(),
    expires_at       TIMESTAMP NOT NULL
);

ALTER TABLE attendees
    ADD COLUMN session_id VARCHAR(255) REFERENCES temp_registration (session_id);

-- Index for cleanup performance
CREATE INDEX idx_temp_registration_expires ON temp_registration (expires_at);
CREATE INDEX idx_temp_registration_session ON temp_registration (session_id);

-- added
CREATE TABLE extras
(
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    price       INT,
    content     JSONB, -- [{name, quantity}]
    event_id    INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE
);
-- added
CREATE TABLE extras_purchase
(
    id              SERIAL PRIMARY KEY,
    extras_data     JSONB,                       -- [{name, price, content:[{name, quantity}]}]
    status          BOOLEAN,                     -- added // scan status
    qr_uuid         VARCHAR(255) UNIQUE NOT NULL,-- added
    scanned_at      TIMESTAMP DEFAULT NULL,      -- added
    registration_id INT                 NOT NULL REFERENCES registration (id) ON DELETE CASCADE
);

CREATE TABLE form_question
(
    id       SERIAL PRIMARY KEY,
    type_id  SMALLINT NOT NULL,
    text     TEXT     NOT NULL,
    required BOOLEAN  NOT NULL,
    options  JSONB,
    event_id INTEGER REFERENCES event ON DELETE CASCADE
);


-- Orders table for successful purchases
CREATE TABLE orders
(
    id                       SERIAL PRIMARY KEY,
    order_number             VARCHAR(50) UNIQUE NOT NULL,
    total_amount             INT                NOT NULL,
    currency                 VARCHAR(3)         NOT NULL DEFAULT 'USD',
    payment_status           VARCHAR(20)        NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
    stripe_payment_intent_id VARCHAR(255),
    items                    JSONB              NOT NULL,
    registration_id          INT                NOT NULL REFERENCES registration (id) ON DELETE CASCADE,
    event_id                 INT                NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    created_at               TIMESTAMP                   DEFAULT NOW(),
    updated_at               TIMESTAMP                   DEFAULT NOW()
);

-- Sponsorship table for tracking donations/sponsorships
CREATE TABLE sponsorship
(
    id                       SERIAL PRIMARY KEY,
    sponsor_data             JSONB       NOT NULL,                                        -- Store all sponsor information as JSONB
    package_type             VARCHAR(50) NOT NULL,                                        -- elite, premier, diamond, etc.
    amount                   INT         NOT NULL,
    currency                 VARCHAR(3)  NOT NULL DEFAULT 'USD',
    payment_status           VARCHAR(20) NOT NULL DEFAULT 'pending',                      -- pending, paid, failed, refunded
    stripe_payment_intent_id VARCHAR(255),
    event_id                 INT         NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    club_id                  INT         NOT NULL REFERENCES club (id) ON DELETE CASCADE,
    registration_id          INT         REFERENCES registration (id) ON DELETE SET NULL, -- Optional link to registration
    created_at               TIMESTAMP            DEFAULT NOW(),
    updated_at               TIMESTAMP            DEFAULT NOW()
);

-- Sponsorship packages table for managing available packages
CREATE TABLE sponsorship_package
(
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    price           INT          NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'USD',
    available_count INT                   DEFAULT -1, -- -1 means unlimited
    features        JSONB        NOT NULL,            -- Array of features with included boolean
    is_active       BOOLEAN               DEFAULT true,
    event_id        INT          NOT NULL REFERENCES event (id) ON DELETE CASCADE,
    club_id         INT          NOT NULL REFERENCES club (id) ON DELETE CASCADE,
    created_at      TIMESTAMP             DEFAULT NOW(),
    updated_at      TIMESTAMP             DEFAULT NOW()
);
