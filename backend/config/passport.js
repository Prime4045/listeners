import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(new GoogleStrategy.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3001/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth profile:', profile); // Debug log
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
                console.log('Linking Google ID to existing user:', user.email);
                user.googleId = profile.id;
                user.avatar = profile.photos[0].value;
            } else {
                console.log('Creating new user for email:', profile.emails[0].value);
                user = new User({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    username: profile.displayName.replace(/\s+/g, '').toLowerCase(),
                    avatar: profile.photos[0].value,
                    isVerified: true,
                });
            }
            await user.save();
        }
        done(null, user);
    } catch (error) {
        console.error('Google Strategy error:', error);
        done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    console.log('Serializing user:', user._id);
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password -mfaSecret');
        if (!user) {
            console.error('Deserialize error: User not found for ID:', id);
            return done(new Error('User not found'), null);
        }
        done(null, user);
    } catch (error) {
        console.error('Deserialize error:', error);
        done(error, null);
    }
});

export default passport;