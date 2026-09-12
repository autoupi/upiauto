# Fix profile saves and add Vercel deploy button

## Changes
- Make profile and UPI saves verify the signed-in user, update only that user’s row, and return the saved values so the screen reflects the database result.
- Reduce uploaded logo/favicon data before saving and show clear save errors instead of silently leaving old values.
- Keep the standalone database installer aligned with the existing profile fields used by the app.
- Add a visible “Deploy with Vercel” button to the GitHub README and retain the existing Vercel configuration.
- Do not change payment matching, QR behavior, polling, webhooks, or daily cleanup.

## Verification
- Check TypeScript/build diagnostics.
- Test profile/UPI update behavior where authentication access permits.
- Confirm the deploy button and Vercel settings are present.

## Technical details
- Existing Supabase profile columns and owner-only access rules are already present, so no live database migration is required.
- The deployment button will open Vercel’s GitHub import screen; environment values still remain private and must be configured in Vercel.
