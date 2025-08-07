import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import User from '../models/User.js';

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('✅ Configuring Google OAuth with credentials...');
  console.log('Client ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...');
  console.log('Callback URL: http://localhost:3001/api/auth/google/callback');
  
  passport.use(
    new GoogleStrategy.Strategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3001/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('🔍 Google OAuth profile received:', {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName
          });
          
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              console.error('❌ No email provided by Google');
              return done(new Error('No email provided by Google'), null);
            }

            // Check if user exists with this email
            const existingEmail = await User.findOne({ email: email.toLowerCase() });
            
            if (existingEmail) {
              console.log('🔗 Linking Google ID to existing user:', existingEmail.email);
              existingEmail.googleId = profile.id;
              existingEmail.avatar = profile.photos?.[0]?.value || null;
              existingEmail.isVerified = true;
              user = await existingEmail.save();
            } else {
              // Generate unique username
              let username = profile.displayName.replace(/\s+/g, '').toLowerCase();
              let usernameBase = username;
              let counter = 1;

              while (await User.findOne({ username })) {
                username = `${usernameBase}${counter}`;
                counter++;
              }

              console.log('👤 Creating new user for email:', email);
              user = new User({
                googleId: profile.id,
                email: email.toLowerCase(),
                username,
                avatar: profile.photos?.[0]?.value || null,
                firstName: profile.name?.givenName || '',
                lastName: profile.name?.familyName || '',
                isVerified: true,
              });
              await user.save();
            }
          } else {
            console.log('✅ Existing Google user found:', user.username);
            // Update avatar if changed
            if (profile.photos?.[0]?.value && user.avatar !== profile.photos[0].value) {
              user.avatar = profile.photos[0].value;
              await user.save();
            }
          }
          
          console.log('✅ Google OAuth success for user:', user.username);
          done(null, user);
        } catch (error) {
          console.error('❌ Google Strategy error:', error);
          done(error, null);
        }
      }
    )
  );
} else {
  console.warn('⚠️ Google OAuth not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  console.log('To enable Google OAuth, add these to your .env file:');
  console.log('GOOGLE_CLIENT_ID=your_google_client_id');
  console.log('GOOGLE_CLIENT_SECRET=your_google_client_secret');
}

passport.serializeUser((user, done) => {
  console.log('📝 Serializing user:', user._id);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password -mfaSecret');
    if (!user) {
      console.error('❌ Deserialize error: User not found for ID:', id);
      return done(null, false);
    }
    console.log('📖 Deserializing user:', user.username);
    done(null, user);
  } catch (error) {
    console.error('❌ Deserialize error:', error);
    done(null, false);
  }
});

export default passport;