-- Adds support for the Managing Director role in existing user data.
-- Run this after deploying the weekly report review feature.

update public.system_users
set role = 'Managing Director',
    department = coalesce(nullif(department, ''), 'Administration')
where lower(coalesce(role, '')) in ('md', 'managing director');

-- Optional example for promoting a specific user manually:
-- update public.system_users
-- set role = 'Managing Director', department = 'Administration'
-- where email = 'md@aspeepharma.com';
