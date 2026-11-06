-- The site is called Lexio. A name that is still the old default is renamed; a name an administrator chose themselves is left alone.
UPDATE settings SET value = '"Lexio"' WHERE key = 'site_name' AND value IN ('"Lexi Learn"', '"Lexi"');
