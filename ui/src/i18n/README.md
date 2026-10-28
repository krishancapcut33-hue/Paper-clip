# UI localization

The UI uses i18next and react-i18next. Keep English messages in `locales/en.json`.
Add reviewed translations to the corresponding locale file. A locale may omit
messages. i18next reads missing messages from English. Do not copy English
placeholders into every locale and do not replace source labels with translated
literals.

Use `useTranslation` in React components. Resolve labels during rendering so a
language change updates the screen. Keep semantic keys in static label maps and
translate those keys inside the component. Include `t` in memo and effect
dependencies when the callback reads translated text. Use named interpolation
for values. Do not translate data identifiers, routes, provider errors, or user
content.

`LocaleSwitcher` uses the existing registered locales and their native names.
The selected language is a browser preference stored as `paperclip.locale`.
The saved choice takes precedence over browser language preferences. If storage
is unavailable, the current choice still works until the page reloads. Locale
changes update the document language and direction. This preference does not
change the language of agent instructions or execution.

Locale validation rejects unknown keys, invalid values, changed interpolation
parameters and unsafe content. Missing keys are allowed for translated catalogs;
strict validation remains the default for callers that require complete catalogs.

The first localized surfaces are email sign-in, organization selection, primary
navigation, account actions, agent lists and basic new-task form controls.
Other UI text remains in its source language. This is incremental coverage,
not a claim that every screen is translated.

Run the locale preference and validation tests plus the LocaleSwitcher component
test. Run the existing tests for each component changed by a translation.
