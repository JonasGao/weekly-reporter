# Preserve Existing Tokens on Collection Source Edit

Editing an existing remote collection source treats an omitted or empty token as “keep the stored token”; only a non-empty token replaces it. Creation still requires a token. This keeps the token out of the browser while allowing non-credential fields, such as branch configuration, to be edited without forcing users to re-enter a secret.
