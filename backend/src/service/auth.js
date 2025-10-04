const {query} = require("../db");
const jwt = require("jsonwebtoken");
const CustomError = require("../model/CustomError");
const clubService = require("./club");
const appUserService = require("./appUser");
const {hash, compare} = require("bcrypt");

const generateAuthData = (user) => {
    const userObj = {
        id: user.id,
        email: user.email,
        role: user.role,
        clubId: user.clubId,
        fullName: user.fullName,
    };
    const token = jwt.sign({currentUser: userObj}, process.env.TOKEN_SECRET, {
        expiresIn: "7d",
    });

    return {
        token,
        currentUser: userObj,
    };
};

exports.signin = async ({email, password}) => {
    const user = await appUserService.getUserByEmail({email});

    if (!user?.email) {
        throw new CustomError("User not found!", 401);
    }
    const isPasswordValid = await compare(password, user.password); // Compare hashed password

    if (!isPasswordValid) {
        throw new CustomError("Incorrect email/password!", 401);
    }
    return generateAuthData(user);
};

exports.register = async ({payload}) => {
    //create club
    const newClub = {
        name: payload.fullName,
    };
    const savedClub = await clubService.save({payload: newClub});

    const newUser = {
        ...payload,
        clubId: savedClub.id,
        password: await hash(payload.password, 10),
        role: 20,
    };

    let upsertedUser = null;
    try {
        const sql = `
            INSERT INTO app_user (full_name, email, password, club_id, role)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const values = [
            newUser.fullName,
            newUser.email,
            newUser.password,
            newUser.clubId,
            newUser.role,
        ];
        const result = await query(sql, values);
        upsertedUser = result.rows[0];
    } catch (err) {
        if (err.code === "23505") {
            await clubService.removeClub({clubId: savedClub.id});
            throw new CustomError("Email already taken!", 409);
        } else throw err;
    }
    return upsertedUser;
};

exports.savePasswordResetRequest = async ({email, token}) => {
    const sql = `
        INSERT INTO password_reset_requests (email, token, expires_at, created_at)
        VALUES ($1, $2, $3, NOW()) RETURNING *
    `;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const result = await query(sql, [email, token, expiresAt]);
    return result.rows[0];
};

exports.validateResetToken = async ({token}) => {
    const sql = `
        SELECT *
        FROM password_reset_requests
        WHERE token = $1
          AND expires_at > NOW()
          AND used = false
    `;
    const result = await query(sql, [token]);
    return result.rows[0];
};
