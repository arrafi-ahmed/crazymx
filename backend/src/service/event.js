const CustomError = require("../model/CustomError");
const {query} = require("../db");
const {removeImages, ifSudo} = require("../utils/common");
const {v4: uuidv4} = require("uuid");

// Helper function to generate slug from event name
const generateSlug = (name) => {
    if (!name) return "";

    return (
        name
            .toLowerCase()
            .trim()
            // Replace spaces and special characters with hyphens
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            // Remove multiple consecutive hyphens
            .replace(/-+/g, "-")
            // Remove leading and trailing hyphens
            .replace(/^-+|-+$/g, "")
    );
};

// Helper function to check if slug is unique
const isSlugUnique = async (slug, excludeId = null) => {
    let sql = "SELECT id FROM event WHERE slug = $1";
    let values = [slug];

    if (excludeId) {
        sql += " AND id != $2";
        values.push(excludeId);
    }

    const result = await query(sql, values);
    return result.rows.length === 0;
};

// Helper function to generate unique slug
const generateUniqueSlug = async (name, excludeId = null) => {
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (!(await isSlugUnique(slug, excludeId))) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return slug;
};

exports.save = async ({payload, files, currentUser}) => {
    const newEvent = {
        ...payload,
        clubId: currentUser.clubId,
        createdBy: currentUser.id,
    };
    const shouldCreate = !newEvent.id;

    // create event
    if (shouldCreate) {
        newEvent.registrationCount = 0;
    }

    // update event - check authorization
    else if (!ifSudo(currentUser.role)) {
        const sql = `
            SELECT *
            FROM event
            WHERE id = $1
              AND club_id = $2
        `;
        const result = await query(sql, [newEvent.id, currentUser.clubId]);
        const existingEvent = result.rows[0];
        if (!existingEvent || !existingEvent.id) {
            throw new CustomError("Access denied", 401);
        }
    }

    // add banner
    if (files && files.length > 0) {
        newEvent.banner = files[0].filename;
    }

    // remove banner
    if (payload.rmImage) {
        await removeImages([payload.rmImage]);
        delete newEvent.rmImage;

        if (!newEvent.banner) newEvent.banner = null;
    }

    // handle slug generation
    if (shouldCreate || (payload.slug && payload.slug !== newEvent.slug)) {
        if (payload.slug && payload.slug.trim()) {
            // User provided a custom slug
            const isUnique = await isSlugUnique(payload.slug, newEvent.id);
            if (!isUnique) {
                throw new CustomError(
                    "Slug already exists. Please choose a different one.",
                    400,
                );
            }
            newEvent.slug = payload.slug;
        } else {
            // Generate slug from name
            newEvent.slug = await generateUniqueSlug(newEvent.name, newEvent.id);
        }
    }
    if (shouldCreate) {
        const sql = `
            INSERT INTO event (name, description, start_datetime, end_datetime, location, banner, slug, currency,
                               tax_type, tax_amount, club_id,
                               created_by, registration_count, config)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
        `;
        const values = [
            newEvent.name,
            newEvent.description,
            newEvent.startDatetime,
            newEvent.endDatetime && newEvent.endDatetime !== '' ? newEvent.endDatetime : null, // Allow null for single day events
            newEvent.location,
            newEvent.banner,
            newEvent.slug,
            newEvent.currency || 'USD',
            newEvent.taxType,
            newEvent.taxAmount,
            newEvent.clubId,
            newEvent.createdBy,
            newEvent.registrationCount,
            newEvent.config
        ];
        const result = await query(sql, values);
        return result.rows[0];
    } else {
        const sql = `
            UPDATE event
            SET name           = $1,
                description    = $2,
                start_datetime = $3,
                end_datetime   = $4,
                location       = $5,
                banner         = $6,
                landing_config = $7,
                slug           = $8,
                currency       = $9,
                tax_type       = $10,
                tax_amount     = $11,
                config         = $12
            WHERE id = $13 RETURNING *
        `;
        const values = [
            newEvent.name,
            newEvent.description,
            newEvent.startDatetime,
            newEvent.endDatetime && newEvent.endDatetime !== '' ? newEvent.endDatetime : null, // Allow null for single day events
            newEvent.location,
            newEvent.banner,
            newEvent.landingConfig,
            newEvent.slug,
            newEvent.currency || 'USD',
            newEvent.taxType,
            newEvent.taxAmount,
            newEvent.config,
            newEvent.id,
        ];
        const result = await query(sql, values);
        return result.rows[0];
    }
};

exports.saveExtras = async ({payload: {newExtras}, currentUser}) => {
    // Remove Stripe-related fields since we're not creating products anymore
    delete newExtras.stripeProductId;
    delete newExtras.stripePriceId;

    // save in db
    const savedExtras = await exports.upsertExtras({
        payload: newExtras,
    });
    return savedExtras;
};

exports.upsertExtras = async ({payload}) => {
    const {id, ...extrasData} = payload;

    if (id) {
        const sql = `
            INSERT INTO extras (id, name, description, price, currency, content, event_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO
            UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                currency = EXCLUDED.currency,
                content = EXCLUDED.content,
                event_id = EXCLUDED.event_id
                RETURNING *
        `;
        const values = [
            id,
            extrasData.name,
            extrasData.description,
            extrasData.price,
            extrasData.currency,
            JSON.stringify(extrasData.content),
            extrasData.eventId,
        ];
        const result = await query(sql, values);
        return result.rows[0];
    } else {
        const sql = `
            INSERT INTO extras (name, description, price, currency, content, event_id)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `;
        const values = [
            extrasData.name,
            extrasData.description,
            extrasData.price,
            extrasData.currency,
            JSON.stringify(extrasData.content),
            extrasData.eventId,
        ];
        const result = await query(sql, values);
        return result.rows[0];
    }
};

exports.saveExtrasPurchase = async ({
                                        extrasIds,
                                        registrationId,
                                        status = false,
                                    }) => {
    const extras = await exports.getExtrasByIds({extrasIds});
    const newExtrasPurchase = {
        extrasData: [],
        status,
        qrUuid: uuidv4(),
        scannedAt: null,
        registrationId,
    };
    newExtrasPurchase.extrasData = extras.map((item, index) => ({
        name: item.name,
        price: item.price,
        content: item.content,
    }));

    const sql = `
        INSERT INTO extras_purchase (extras_data, status, qr_uuid, scanned_at, registration_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [
        JSON.stringify(newExtrasPurchase.extrasData),
        newExtrasPurchase.status,
        newExtrasPurchase.qrUuid,
        newExtrasPurchase.scannedAt,
        newExtrasPurchase.registrationId,
    ];
    const result = await query(sql, values);
    return result.rows[0];
};

exports.updateExtrasPurchaseStatus = async ({payload: {id, status}}) => {
    const sql = `
        UPDATE extras_purchase
        SET status     = $1,
            scanned_at = CASE
                             WHEN $1 = TRUE THEN NOW() -- Set to current timestamp if status is true
                             ELSE scanned_at -- Otherwise, keep its existing value
                END
        WHERE id = $2 RETURNING *;
    `;
    const extras = await query(sql, [status, id]);
    return extras.rows[0];
};

exports.getExtrasById = async ({extrasId}) => {
    const sql = `
        SELECT *
        FROM extras
        WHERE id = $1`;
    const extras = await query(sql, [extrasId]);
    return extras.rows[0];
};

exports.getExtrasByIds = async ({extrasIds}) => {
    const sql = `
        SELECT *
        FROM extras
        WHERE id IN ($1)`;
    const extras = await query(sql, [extrasIds]);
    return extras.rows;
};

exports.getExtrasByEventId = async ({eventId}) => {
    const sql = `
        SELECT *
        FROM extras
        WHERE event_id = $1`;
    const extras = await query(sql, [eventId]);
    return extras.rows;
};

exports.removeEvent = async ({eventId, clubId}) => {
    const sql = `
        DELETE
        FROM event
        WHERE id = $1
          AND club_id = $2 RETURNING *;`;

    const deletedEvent = await query(sql, [eventId, clubId]);

    if (deletedEvent.rows[0]?.banner) {
        await removeImages([deletedEvent.rows[0].banner]);
    }
    return deletedEvent.rows[0];
};

exports.removeExtras = async ({eventId, extrasId}) => {
    const sql = `
        DELETE
        FROM extras
        WHERE id = $1
          AND event_id = $2 RETURNING *;`;
    const deletedExtras = await query(sql, [extrasId, eventId]);

    return deletedExtras.rows[0];
};

exports.getEventById = async ({eventId}) => {
    const sql = `
        SELECT *
        FROM event
        WHERE id = $1`;
    const event = await query(sql, [eventId]);
    return event.rows[0];
};

exports.getEventBySlug = async ({slug}) => {
    const sql = `
        SELECT *
        FROM event
        WHERE slug = $1`;
    const event = await query(sql, [slug]);
    return event.rows[0];
};

exports.getEventByEventIdnClubId = async ({clubId, eventId, currentUser}) => {
    if (!eventId || !clubId || !currentUser) {
        throw new CustomError("Access denied", 403);
    }

    const sql = `
        SELECT *
        FROM event
        WHERE id = $1
          AND club_id = $2`;
    const result = await query(sql, [eventId, clubId]);

    if (!result.rows[0]) {
        throw new CustomError("Event not found", 404);
    }

    return result.rows[0];
};

exports.getAllEvents = async ({
                                  clubId,
                                  page = 1,
                                  itemsPerPage = 6,
                                  offset = 0,
                                  fetchTotalCount = false
                              } = {}) => {
    // Get total count if requested
    let totalCount = 0;
    if (fetchTotalCount) {
        const countSql = `
            SELECT COUNT(*) as total
            FROM event
            WHERE club_id = $1
        `;
        const countResult = await query(countSql, [clubId]);
        totalCount = parseInt(countResult.rows[0].total);
    }

    const sql = `
        SELECT *
        FROM event
        WHERE club_id = $1
        ORDER BY start_datetime ASC
        LIMIT $2 OFFSET $3`;
    const result = await query(sql, [clubId, itemsPerPage, offset]);

    return {
        items: result.rows,
        totalItems: totalCount,
        page,
        itemsPerPage,
        totalPages: Math.ceil(totalCount / itemsPerPage)
    };
};

exports.increaseRegistrationCount = async ({eventId}) => {
    const sql = `
        UPDATE event
        SET registration_count = registration_count + 1
        WHERE id = $1 RETURNING *;`;
    const updatedEvent = await query(sql, [eventId]);
    return updatedEvent.rows[0];
};

exports.getAllActiveEvents = async ({clubId, currentDate}) => {
    // const currentDate = new Date().toISOString().split("T")[0]; // Format the date as YYYY-MM-DD
    const sql = `
        SELECT *
        FROM event
        WHERE club_id = $1
          AND (
            (end_datetime IS NOT NULL AND $2::date < end_datetime) OR
            (end_datetime IS NULL AND $2::date >= start_datetime::date)
            )
        ORDER BY start_datetime ASC;
    `;
    const results = await query(sql, [clubId, currentDate]);
    return results.rows;
};

exports.getFirstEvent = async () => {
    const sql = `
        SELECT e.*, c.name as club_name, c.location as club_location, c.logo as club_logo
        FROM event e
                 JOIN club c ON e.club_id = c.id
        WHERE e.start_datetime >= CURRENT_DATE
        ORDER BY e.start_datetime ASC LIMIT 1
    `;
    const result = await query(sql);
    return result.rows[0];
};

exports.saveConfig = async ({payload, currentUser}) => {
    // const eventId = payload.id;

    // // Check authorization
    // if (!ifSudo(currentUser.role)) {
    //     const sql = `
    //         SELECT *
    //         FROM event
    //         WHERE id = $1
    //           AND club_id = $2
    //     `;
    //     const result = await query(sql, [eventId, currentUser.clubId]);
    //     const existingEvent = result.rows[0];
    //     if (!existingEvent || !existingEvent.id) {
    //         throw new CustomError("Access denied", 401);
    //     }
    // }

    // // Prepare configuration object
    // const config = {
    //     maxTicketsPerRegistration: parseInt(payload.maxTicketsPerRegistration) || 10,
    //     allowMultipleRegistrations: payload.allowMultipleRegistrations === 'true',
    //     saveAllAttendeesDetails: payload.saveAllAttendeesDetails === 'true',
    //     isSingleDayEvent: payload.isSingleDayEvent === 'true',
    // };

    // Update event with configuration
    const sql = `
        UPDATE event
        SET config = $1
        WHERE id = $2 RETURNING *
    `;

    const values = [
        JSON.stringify(payload.config),
        payload.eventId
    ];

    const result = await query(sql, values);
    return result.rows[0];
};

exports.saveLandingConfig = async ({payload, currentUser}) => {
    const eventId = payload.id;

    // Check authorization
    if (!ifSudo(currentUser.role)) {
        const sql = `
            SELECT *
            FROM event
            WHERE id = $1
              AND club_id = $2
        `;
        const result = await query(sql, [eventId, currentUser.clubId]);
        const existingEvent = result.rows[0];
        if (!existingEvent || !existingEvent.id) {
            throw new CustomError("Access denied", 401);
        }
    }

    // Prepare landing configuration object
    const landingConfig = {
        enableLandingPage: payload.enableLandingPage === 'true',
        heroTitle: payload.heroTitle || '',
        heroSubtitle: payload.heroSubtitle || '',
        overviewTitle: payload.overviewTitle || '',
        overviewDescription: payload.overviewDescription || '',
        customCSS: payload.customCSS || '',
        customJS: payload.customJS || '',
    };

    // Update event with landing configuration
    const sql = `
        UPDATE event
        SET landing_config = $1
        WHERE id = $2 RETURNING *
    `;

    const values = [
        JSON.stringify(landingConfig),
        eventId
    ];

    const result = await query(sql, values);
    return result.rows[0];
};
