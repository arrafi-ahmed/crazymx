const {query} = require("../db");
const CustomError = require("../model/CustomError");

exports.save = async ({payload, files, currentUser}) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const {id, ...clubData} = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!clubData.name || !clubData.name.trim()) {
        throw new CustomError("Club name is required", 400);
    }

    // Handle file uploads if provided
    if (files && files.length > 0) {
        clubData.logo = files[0].filename;
    }

    if (id) {
        // Update existing club
        const sql = `
            INSERT INTO club (id, name, location, logo)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                location = EXCLUDED.location,
                logo = EXCLUDED.logo
            RETURNING *
        `;
        const values = [id, clubData.name, clubData.location, clubData.logo];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update club", 500);
        }

        return result.rows[0];
    } else {
        // Create new club
        const sql = `
            INSERT INTO club (name, location, logo)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const values = [clubData.name, clubData.location, clubData.logo];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create club", 500);
        }

        return result.rows[0];
    }
};

exports.getAllClubs = async () => {
    const sql = `
        SELECT *
        FROM club
        ORDER BY created_at DESC
    `;
    const result = await query(sql);
    return result.rows;
};

exports.getClubById = async ({clubId}) => {
    if (!clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM club
        WHERE id = $1
    `;
    const result = await query(sql, [clubId]);

    if (!result.rows[0]) {
        throw new CustomError("Club not found", 404);
    }

    return result.rows[0];
};

exports.deleteClub = async ({clubId}) => {
    if (!clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    const sql = `
        DELETE FROM club
        WHERE id = $1
        RETURNING *
    `;
    const result = await query(sql, [clubId]);

    if (!result.rows[0]) {
        throw new CustomError("Club not found", 404);
    }

    return result.rows[0];
};
