import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(
    new GoogleStrategy.Strategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BACKEND_URL || 'http://localhost:12001'}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google OAuth profile:', profile); // Debug log
                let user = await User.findOne({ googleId: profile.id });

                if (!user) {
                    const existingEmail = await User.findOne({ email: profile.emails[0].value });
                    let username = profile.displayName.replace(/\s+/g, '').toLowerCase();
                    let usernameBase = username;
                    let counter = 1;

                    // Check for existing username and append a suffix if necessary
                    while (await User.findOne({ username })) {
                        username = `${usernameBase}${counter}`;
                        counter++;
                    }

                    if (existingEmail) {
                        console.log('Linking Google ID to existing user:', existingEmail.email);
                        existingEmail.googleId = profile.id;
                        existingEmail.avatar = profile.photos[0]?.value || null;
                        existingEmail.isVerified = true;
                        user = await existingEmail.save();
                    } else {
                        console.log('Creating new user for email:', profile.emails[0].value);
                        user = new User({
                            googleId: profile.id,
                            email: profile.emails[0].value,
                            username,
                            avatar: profile.photos[0]?.value || null,
                            firstName: profile.name?.givenName || '',
                            lastName: profile.name?.familyName || '',
                            isVerified: true,
                        });
                        await user.save();
                    }
                }
                done(null, user);
            } catch (error) {
                console.error('Google Strategy error:', error);
                done(new Error(`OAuth failed: ${error.message}`), null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user._id);
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password -mfaSecret');
        if (!user) {
            console.error('Deserialize error: User not found for ID:', id);
            return done(null, false); // Return false instead of error
        }
        console.log('Deserializing user:', user._id);
        done(null, user);
    } catch (error) {
        console.error('Deserialize error:', error);
        done(null, false); // Return false instead of error to prevent crashes
    }
});

export default passport;