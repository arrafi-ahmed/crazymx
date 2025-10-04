const {query} = require("../db");
const CustomError = require("../model/CustomError");

exports.save = async ({payload}) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const {id, ...userData} = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!userData.email || !userData.email.trim()) {
        throw new CustomError("Email is required", 400);
    }

    if (!userData.password || !userData.password.trim()) {
        throw new CustomError("Password is required", 400);
    }

    if (!userData.clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    if (id) {
        // Update existing user
        const sql = `
            INSERT INTO app_user (id, full_name, email, password, role, club_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW()) ON CONFLICT (id) DO
            UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                password = EXCLUDED.password,
                role = EXCLUDED.role,
                club_id = EXCLUDED.club_id
                RETURNING *
        `;
        const values = [
            id,
            userData.fullName,
            userData.email,
            userData.password,
            userData.role,
            userData.clubId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update user", 500);
        }

        return result.rows[0];
    } else {
        // Create new user
        const sql = `
            INSERT INTO app_user (full_name, email, password, role, club_id, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *
        `;
        const values = [
            userData.fullName,
            userData.email,
            userData.password,
            userData.role,
            userData.clubId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create user", 500);
        }

        return result.rows[0];
    }
};

exports.updateUser = async ({id, userData}) => {
    if (!id) {
        throw new CustomError("User ID is required", 400);
    }

    if (!userData) {
        throw new CustomError("User data is required", 400);
    }

    const sql = `
        UPDATE app_user
        SET full_name = $2,
            email     = $3,
            password  = $4,
            role      = $5,
            club_id   = $6
        WHERE id = $1 RETURNING *
    `;
    const values = [
        id,
        userData.fullName,
        userData.email,
        userData.password,
        userData.role,
        userData.clubId,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("User not found", 404);
    }

    return result.rows[0];
};

exports.saveUser = async ({userData}) => {
    if (!userData) {
        throw new CustomError("User data is required", 400);
    }

    const sql = `
        INSERT INTO app_user (full_name, email, password, role, club_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [
        userData.fullName,
        userData.email,
        userData.password,
        userData.role,
        userData.clubId,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create user", 500);
    }

    return result.rows[0];
};

exports.getUserByEmail = async ({email}) => {
    if (!email || !email.trim()) {
        throw new CustomError("Email is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE email = $1
    `;
    const result = await query(sql, [email]);
    return result.rows[0];
};

exports.getUserById = async ({userId}) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE id = $1
    `;
    const result = await query(sql, [userId]);

    if (!result.rows[0]) {
        throw new CustomError("User not found", 404);
    }

    return result.rows[0];
};

// Get all users for a club
exports.getUsers = async ({clubId}) => {
    if (!clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM app_user
        WHERE club_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [clubId]);
    return result.rows;
};

// Remove user
exports.removeUser = async ({userId, clubId}) => {
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    if (!clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    const sql = `
        DELETE FROM app_user
        WHERE id = $1 AND club_id = $2
        RETURNING *
    `;
    const result = await query(sql, [userId, clubId]);

    if (!result.rows[0]) {
        throw new CustomError("User not found or access denied", 404);
    }

    return result.rows[0];
};
