// Intentionally empty.
//
// This step was briefly used to collect a password inline during the full
// onboarding wizard. It's been superseded by /auth/invitee-setup, which is
// the dedicated fast-path (name + password only) for invited users. Keeping
// this module as an empty shell so existing imports fail fast rather than
// silently resurrecting dead UI. Delete whenever the repo is next tidied.

export {};
